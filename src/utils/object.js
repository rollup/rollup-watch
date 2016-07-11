export function assign ( target, ...sources ) {
	sources.forEach( source => {
		for ( let key in source ) {
			if ( source.hasOwnProperty( key ) ) target[ key ] = source[ key ];
		}
	});

	return target;
}
