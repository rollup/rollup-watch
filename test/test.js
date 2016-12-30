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

	it( 'watches a file', done => {
		sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			function waitFor ( code, cb ) {
				watcher.once( 'event', event => {
					if ( event.code !== code ) {
						done( new Error( `Expected ${code} error, got ${event.code}` ) );
					} else {
						cb();
					}
				});
			}

			waitFor( 'BUILD_START', () => {
				waitFor( 'BUILD_END', () => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );

					sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );

					waitFor( 'BUILD_START', () => {
						waitFor( 'BUILD_END', () => {
							assert.equal( run( './_tmp/output/bundle.js' ), 43 );
							done();
						});
					});
				});
			});
		});
	});

	it( 'recovers from an error', done => {
		sander.copydir( 'test/samples/basic' ).to( 'test/_tmp/input' ).then( () => {
			const watcher = watch( rollup, {
				entry: 'test/_tmp/input/main.js',
				dest: 'test/_tmp/output/bundle.js',
				format: 'cjs'
			});

			function waitFor ( code, cb ) {
				watcher.once( 'event', event => {
					if ( event.code !== code ) {
						done( new Error( `Expected ${code} error, got ${event.code}` ) );
					} else {
						cb();
					}
				});
			}

			waitFor( 'BUILD_START', () => {
				waitFor( 'BUILD_END', () => {
					assert.equal( run( './_tmp/output/bundle.js' ), 42 );

					sander.writeFileSync( 'test/_tmp/input/main.js', 'export nope;' );

					waitFor( 'BUILD_START', () => {
						waitFor( 'ERROR', () => {
							sander.writeFileSync( 'test/_tmp/input/main.js', 'export default 43;' );

							waitFor( 'BUILD_START', () => {
								waitFor( 'BUILD_END', () => {
									assert.equal( run( './_tmp/output/bundle.js' ), 43 );
									done();
								});
							});
						});
					});
				});
			});
		});
	});
});
