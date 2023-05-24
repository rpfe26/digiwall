import Vue from 'vue'
const dayjs = require('dayjs')
require('dayjs/locale/fr')
require('dayjs/locale/es')
require('dayjs/locale/it')
require('dayjs/locale/hr')
const localizedFormat = require('dayjs/plugin/localizedFormat')
const relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(localizedFormat)
dayjs.extend(relativeTime)

Vue.prototype.$formaterDate = function (date, langue) {
	let dateFormattee = ''
	switch (langue) {
	case 'fr':
		dateFormattee = dayjs(new Date(date)).locale('fr').format('L') + ' à ' + dayjs(new Date(date)).locale('fr').format('LT')
		break
	case 'es':
		dateFormattee = dayjs(new Date(date)).locale('es').format('L') + ' a las ' + dayjs(new Date(date)).locale('es').format('LT')
		break
	case 'it':
		dateFormattee = dayjs(new Date(date)).locale('it').format('L') + ' alle ' + dayjs(new Date(date)).locale('it').format('LT')
		break
	case 'hr':
		dateFormattee = dayjs(new Date(date)).locale('hr').format('L') + ' u ' + dayjs(new Date(date)).locale('hr').format('LT')
		break
	case 'en':
		dateFormattee = dayjs(new Date(date)).locale('en').format('L') + ' at ' + dayjs(new Date(date)).locale('en').format('LT')
		break
	}
	return dateFormattee
}

Vue.prototype.$formaterDateRelative = function (date, langue) {
	return dayjs(new Date(date)).locale(langue).fromNow()
}

Vue.prototype.$verifierEmail = function (email) {
	const regexExp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/gi
	return regexExp.test(email)
}
