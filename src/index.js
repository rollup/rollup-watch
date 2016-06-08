import EventEmitter from 'events';
import * as chokidar from 'chokidar';
import { sequence } from './utils/promise.js';
import { name, version } from '../package.json';
import checkVersion from './utils/checkVersion.js';

export default function watch ( rollup, options ) {
	const emitter = new EventEmitter();

	process.nextTick( () => emitter.emit( 'event', { code: 'STARTING' }) );

	checkVersion( name, version )
		.catch( err => {
			if ( err.code === 'OUT_OF_DATE' ) {
				// TODO offer to update
				console.error( `rollup-watch is out of date (you have ${err.localVersion}, latest version is ${err.latestVersion}). Update it with npm install -g rollup-watch` );
			}
		})
		.then( () => {
			let watchedIds;
			let rebuildScheduled = false;
			let building = false;

			let watcher;

			function triggerRebuild () {
				rebuildScheduled = true;
				if ( !building ) build();
			}

			function build () {
				if ( building ) return;

				let start = Date.now();
				let initial = !watcher;

				emitter.emit( 'event', { code: 'BUILD_START' });

				rebuildScheduled = false;
				building = true;

				return rollup.rollup( options )
					.then( bundle => {
						const moduleIds = bundle.modules.map( module => module.id );

						if ( !watcher ) {
							watcher = chokidar.watch( moduleIds, {
								persistent: true,
								ignoreInitial: true
							});

							watcher.on( 'change', triggerRebuild );
							watcher.on( 'unlink', triggerRebuild );

							watchedIds = moduleIds;
						} else {
							moduleIds.forEach( id => {
								if ( !~watchedIds.indexOf( id ) ) {
									watcher.add( id );
								}
							});

							watchedIds.forEach( id => {
								if ( !~moduleIds.indexOf( id ) ) {
									watcher.unwatch( id );
								}
							});
						}

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

						building = false;
						if ( rebuildScheduled ) build();
					});
			}

			build();
		});

	return emitter;
}
