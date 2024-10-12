module.exports = {
	apps: [{
		name: 'Digiwall',
		script: './server/index.js',
		autorestart: true,
		max_restarts: 10,
		env: {
			'NODE_ENV': 'development'
		},
		env_production: {
			'NODE_ENV': 'production'
		}
	}]
}