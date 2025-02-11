import axios from 'axios'

export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps
	let redirection = '/'
	const id = pageContext.routeParams.id
	const token = pageContext.routeParams.token
	const identifiant = pageContext.identifiant
	const statut = pageContext.statut
	let murs = pageContext.murs
	const reponse = await axios.post(pageContext.hote + '/api/recuperer-donnees-mur', {
		id: id,
		token: token,
		identifiant: identifiant,
		statut: statut,
		murs: murs
	}, {
		headers: { 'Content-Type': 'application/json' }
	}).catch(function () {
		if (statut === 'utilisateur') {
			redirection = '/u/' + identifiant
		}
		pageProps = { redirection }
	})
	if (!reponse || !reponse.hasOwnProperty('data') || !reponse.data.hasOwnProperty('mur') || !reponse.data.hasOwnProperty('blocs') || !reponse.data.hasOwnProperty('activite') || (reponse.data && reponse.data === 'erreur')) {
		if (statut === 'utilisateur') {
			redirection = '/u/' + identifiant
		}
		pageProps = { redirection }
	} else {
		let admin = false
		if ((reponse.data.mur.hasOwnProperty('identifiant') && reponse.data.mur.identifiant === identifiant) || (reponse.data.mur.hasOwnProperty('admins') && reponse.data.mur.admins.includes(identifiant)) || (statut === 'auteur' && reponse.data.mur.hasOwnProperty('id') && murs.includes(reponse.data.mur.id))) {
			admin = true
		}
		if (!admin && reponse.data.mur.acces === 'prive' && statut === 'utilisateur') {
			redirection = '/u/' + identifiant
			pageProps = { redirection }
		} else if (!admin && reponse.data.mur.acces === 'prive' && statut !== 'utilisateur') {
			pageProps = { redirection }
		} else {
			const params = pageContext.params
			const hote = pageContext.hote
			const userAgent = pageContext.userAgent
			const langues = pageContext.langues
			const nom = pageContext.nom
			const langue = pageContext.langue
			const blocsAutorises = pageContext.blocsAutorises
			const mur = reponse.data.mur
			const blocs = reponse.data.blocs
			const activite = reponse.data.activite
			const titre = mur.titre + ' - Digiwall by La Digitale'
			if (!admin) {
				murs = []
			}
			pageProps = { params, hote, userAgent, langues, identifiant, nom, langue, statut, murs, blocsAutorises, mur, blocs, activite, titre }
		}
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
