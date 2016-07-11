import EventEmitter from 'events';
import * as fs from 'fs';
import { sequence } from './utils/promise.js';
import { assign } from './utils/object.js';
import { name, version } from '../package.json';
import checkVersion from './utils/checkVersion.js';

const opts = { encoding: 'utf-8', persistent: true };

class FileWatcher {
	constructor ( file, data, callback, dispose ) {
		try {
			const fsWatcher = fs.watch( file, opts, event => {
				if ( event === 'rename' ) {
					fsWatcher.close();
					dispose();
					callback();
				} else {
					// this is necessary because we get duplicate events...
					const contents = fs.readFileSync( file, 'utf-8' );
					if ( contents !== data ) {
						data = contents;
						callback();
					}
				}
			});

			this.fileExists = true;
		} catch ( err ) {
			if ( err.code === 'ENOENT' ) {
				// can't watch files that don't exist (e.g. injected
				// by plugins somehow)
				this.fileExists = false;
			} else {
				throw err;
			}
		}
	}
}

export default function watch ( rollup, options ) {
	const emitter = new EventEmitter();

	process.nextTick( () => emitter.emit( 'event', { code: 'STARTING' }) );

	checkVersion( name, version )
		.catch( err => {
			if ( err.code === 'OUT_OF_DATE' ) {
				// TODO offer to update
				console.error( `rollup-watch is out of date (you have ${err.localVersion}, latest version is ${err.latestVersion}). Update it with npm install -g rollup-watch` ); // eslint-disable-line no-console
			}
		})
		.then( () => {
			let filewatchers = new Map();

			let rebuildScheduled = false;
			let building = false;
			let watching = false;

			let timeout;
			let cache;

			function triggerRebuild () {
				clearTimeout( timeout );
				rebuildScheduled = true;

				timeout = setTimeout( () => {
					if ( !building ) {
						rebuildScheduled = false;
						build();
					}
				}, 50 );
			}

			function build () {
				if ( building ) return;

				let start = Date.now();
				let initial = !watching;
				let opts = assign( {}, options, cache ? { cache } : {});

				emitter.emit( 'event', { code: 'BUILD_START' });

				building = true;

				return rollup.rollup( opts )
					.then( bundle => {
						// Save off bundle for re-use later
						cache = bundle;

						bundle.modules.forEach( module => {
							const id = module.id;

							// skip plugin helper modules
							if ( /\0/.test( id ) ) return;

							if ( !filewatchers.has( id ) ) {
								const watcher = new FileWatcher( id, module.originalCode, triggerRebuild, () => {
									filewatchers.delete( id );
								});

								if ( watcher.fileExists ) filewatchers.set( id, watcher );
							}
						});

						if ( options.targets ) {
							return sequence( options.targets, target => {
								const mergedOptions = Object.assign( {}, options, target );
								return bundle.write( mergedOptions );
							});
						}

						return bundle.write( options );
					})
					.then( () => {
						emitter.emit( 'event', {
							code: 'BUILD_END',
							duration: Date.now() - start,
							initial
						});
					}, error => {
						emitter.emit( 'event', {
							code: 'ERROR',
							error
						});
					})
					.then( () => {
						building = false;
						if ( rebuildScheduled ) build();
					});
			}

			build();
		});

	return emitter;
}
