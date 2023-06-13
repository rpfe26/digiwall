import axios from 'axios'

export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps
	let redirection = '/'
	const id = pageContext.routeParams.id
	const token = pageContext.routeParams.token
	const identifiant = pageContext.identifiant
	const statut = pageContext.statut
	const reponse = await axios.post(pageContext.hote + '/api/recuperer-donnees-mur', {
		id: id,
		token: token,
		identifiant: identifiant,
		statut: statut
	}, {
		headers: { 'Content-Type': 'application/json' }
	}).catch(function () {
		if (statut === 'utilisateur') {
			redirection = '/u/' + identifiant
		}
		pageProps = { redirection }
	})
	if (!reponse || !reponse.hasOwnProperty('data') || (reponse.data && reponse.data === 'erreur_mur')) {
		if (statut === 'utilisateur') {
			redirection = '/u/' + identifiant
		}
		pageProps = { redirection }
	} else {
		const params = pageContext.params
		const hote = pageContext.hote
		const userAgent = pageContext.userAgent
		const langues = pageContext.langues
		const identifiant = pageContext.identifiant
		const nom = pageContext.nom
		const langue = pageContext.langue
		const statut = pageContext.statut
		const acces = pageContext.acces
		const murs = pageContext.murs
		const digidrive = pageContext.digidrive
		const mur = reponse.data.mur
		const blocs = reponse.data.blocs
		const activite = reponse.data.activite
		const titre = mur.titre + ' - Digiwall by La Digitale'
		pageProps = { params, hote, userAgent, langues, identifiant, nom, langue, statut, acces, murs, digidrive, mur, blocs, activite, titre }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
