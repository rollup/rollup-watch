import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import buble from 'rollup-plugin-buble';

export default {
	entry: 'src/index.js',
	plugins: [
		nodeResolve(),
		commonjs(),
		json(),
		buble({ target: { node: 4 } })
	],
	external: [ 'module', 'events', 'fs', 'path' ],
	targets: [
		{ dest: 'dist/rollup-watch.cjs.js', format: 'cjs' },
		{ dest: 'dist/rollup-watch.es.js', format: 'es' }
	]
};
