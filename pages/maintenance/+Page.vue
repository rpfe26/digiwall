<template>
	<div id="page">
		<div id="maintenance">
			<h1>{{ $t('maintenance') }}</h1>
			<h3>{{ $t('maintenanceDigiwall') }}</h3>
		</div>

		<ChargementPage v-if="chargementPage" />
	</div>
</template>

<script>
import ChargementPage from '#root/components/chargement-page.vue'

export default {
	name: 'Maintenance',
	components: {
		ChargementPage
	},
	data () {
		return {
			chargementPage: true,
			langues: this.$pageContext.pageProps.langues,
			langue: this.$pageContext.pageProps.langue
		}
	},
	created () {
		const params = this.$pageContext.pageProps.params
		const langueNav = navigator.language.substring(0, 2)
		const langueParam = params.lang
		if (langueParam && langueParam !== '' && this.langues.includes(langueParam) === true) {
			this.langue = langueParam
			localStorage.setItem('digiwall_lang', langueParam)
		} else if (!langueParam && langueNav !== '' && this.langues.includes(langueNav) === true) {
			this.langue = langueNav
		} 
		if (localStorage.getItem('digiwall_lang')) {
			this.langue = localStorage.getItem('digiwall_lang')
		}
		this.$i18n.locale = this.langue
		if (this.langue !== this.$pageContext.pageProps.langue) {
			this.$socket.emit('modifierlangue', this.langue)
		}
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		setTimeout(function () {
			this.chargementPage = false
		}.bind(this), 300)
	}
}
</script>

<style scoped>
#page {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
	height: 100%;
	overflow: auto;
}

#maintenance {
	padding: 2rem;
	margin-bottom: 7rem;
}

#page h1 {
	font-size: 4.5rem;
	text-transform: uppercase;
	text-align: center;
	margin-bottom: 3rem;
}

#page h3 {
	font-size: 2.7rem;
	text-align: center;
}

@media screen and (max-width: 599px) {
	#page h1 {
		font-size: 3.2rem;
	}

	#page h3 {
		font-size: 2rem;
	}
}
</style>
