import { exec } from 'child_process';

export default function ( name, localVersion ) {
	return new Promise( ( fulfil, reject ) => {
		exec( `npm show ${name} version`, ( err, result ) => {
			if ( err ) return reject( err );
			fulfil( result.trim() );
		});
	}).then( latestVersion => {
		if ( semver.gt( latestVersion, localVersion ) ) {
			let err = new Error( `${name} is out of date` );
			err.code = 'OUT_OF_DATE';
			err.localVersion = localVersion;
			err.latestVersion = latestVersion;
		}
	});
};
