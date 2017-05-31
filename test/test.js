const assert = require( 'assert' );
const sander = require( 'sander' );
const rollup = require( 'rollup' );
const watch = require( '..' );

describe( 'rollup-watch', () => {
	beforeEach( () => sander.rimraf( 'test/_tmp' ) );

	function run ( file ) {
		const resolved = require.resolve( file );
		delete require.cache[ resolved ];
		return require( resolved );
	}

	function sequence ( watcher, events ) {
		return new Promise( ( fulfil, reject ) => {
			function go ( event ) {
				const next = events.shift();

				if ( !next ) {
					fulfil();
				}

				else if ( typeof next === 'string' ) {
					watcher.once( 'event', event => {
						if ( event.code !== next ) {
							reject( new Error( `Expected ${next} error, got ${event.code}` ) );
						} else {
							go( event );
						}
					});
				}

				else {
					Promise.resolve()
						.then( () => next( event ) )
						.then( go )
						.catch( reject );
				}
			}

			go();
		});
	}

	it( 'watches a file', () => {
		return sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			return sequence( watcher, [
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );
				},
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 43 );
					watcher.close();
				}
			]);
		});
	});

	it( 'recovers from an error', () => {
		return sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			return sequence( watcher, [
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export nope;' );
				},
				'BUILD_START',
				'ERROR',
				() => {
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );
				},
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 43 );
					watcher.close();
				}
			]);
		});
	});

	it( 'recovers from an error even when erroring file was "renamed" (#38)', () => {
		return sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			return sequence( watcher, [
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );
					sander.unlinkSync( 'test/_tmp/input/main.js' );
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export nope;' );
				},
				'BUILD_START',
				'ERROR',
				() => {
					sander.unlinkSync( 'test/_tmp/input/main.js' );
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );
				},
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 43 );
					watcher.close();
				}
			]);
		});
	});

	it( 'refuses to watch the output file (#15)', () => {
		return sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			return sequence( watcher, [
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );
					sander.writeFileSync( 'test/_tmp/input/main.js', `import '../output/bundle.js'` );
				},
				'BUILD_START',
				'ERROR',
				event => {
					assert.equal( event.error.message, 'Cannot import the generated bundle' );
					sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );
				},
				'BUILD_START',
				'BUILD_END',
				() => {
					assert.equal( run( './_tmp/output/bundle.js' ), 43 );
					watcher.close();
				}
			]);
		});
	});
});
