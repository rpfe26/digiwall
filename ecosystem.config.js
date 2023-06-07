module.exports = {
	apps: [{
    	name: 'Digiwall',
    	script: 'npm -- run server:prod',
		autorestart: true,
		max_restarts: 10
	}]
}
