import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/index.js',
	plugins: [ buble() ],
	targets: [
		{ dest: 'dist/rollup-watch.cjs.js', format: 'cjs' },
		{ dest: 'dist/rollup-watch.es6.js', format: 'es6' }
	]
};
