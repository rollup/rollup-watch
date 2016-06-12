import EventEmitter from 'events';
import * as fs from 'fs';
import { sequence } from './utils/promise.js';
import { name, version } from '../package.json';
import checkVersion from './utils/checkVersion.js';

class FileWatcher {
	constructor ( file, data, callback, dispose ) {
		const fsWatcher = fs.watch( file, { encoding: 'utf-8', persistent: true }, event => {
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

				emitter.emit( 'event', { code: 'BUILD_START' });

				building = true;

				return rollup.rollup( options )
					.then( bundle => {
						bundle.modules.forEach( module => {
							const id = module.id;

							if ( !filewatchers.has( id ) ) {
								const watcher = new FileWatcher( id, module.originalCode, triggerRebuild, () => {
									filewatchers.delete( id );
								});

								filewatchers.set( id, watcher );
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
