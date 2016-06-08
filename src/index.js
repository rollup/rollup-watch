import * as chokidar from 'chokidar';
import relative from 'require-relative';
import { sequence } from './utils/promise.js';

export default function watch ( options ) {
	let rollup;

	try {
		rollup = relative( 'rollup', process.cwd() );
	} catch ( err ) {
		// TODO handle gracefully
		throw err;
	}

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
				building = false;
				if ( rebuildScheduled ) build();
			});
	}

	build();
}
