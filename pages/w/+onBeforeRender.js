import axios from 'axios'
import base64 from 'base-64'

export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps
	let redirection = '/'
	const id = pageContext.routeParams.id
	const token = pageContext.routeParams.token
	let identifiant = pageContext.identifiant
	let statut = pageContext.statut
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
	if (!reponse || !reponse.hasOwnProperty('data') || !reponse.data.hasOwnProperty('mur') || !reponse.data.hasOwnProperty('blocs') || !reponse.data.hasOwnProperty('activite') || (reponse.data && reponse.data === 'erreur_mur')) {
		if (statut === 'utilisateur') {
			redirection = '/u/' + identifiant
		}
		pageProps = { redirection }
	} else {
		let admin = false
		if ((reponse.data.mur.identifiant === identifiant) || (reponse.data.mur.admins.includes(identifiant))) {
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
			let nom = pageContext.nom
			let langue = pageContext.langue
			const acces = pageContext.acces
			const murs = pageContext.murs
			const blocsAutorises = pageContext.blocsAutorises
			let digidrive = pageContext.digidrive
			const mur = reponse.data.mur
			const blocs = reponse.data.blocs
			const activite = reponse.data.activite
			const titre = mur.titre + ' - Digiwall by La Digitale'
			// Vérification des paramètres Digidrive
			const paramId = params.id
			const paramMdp = params.mdp
			if (paramId && paramId !== '' && paramMdp && paramMdp !== '') {
				const donneesAcces = await axios.post(hote + '/api/verifier-acces', {
					mur: id,
					identifiant: paramId,
					motdepasse: base64.decode(paramMdp)
				})
				if (donneesAcces.data.hasOwnProperty('message') && donneesAcces.data.message === 'mur_debloque') {
					identifiant = paramId
					nom = donneesAcces.data.nom
					langue = donneesAcces.data.langue
					statut = 'auteur'
					digidrive = donneesAcces.data.digidrive
				}
			}
			pageProps = { params, hote, userAgent, langues, identifiant, nom, langue, statut, acces, murs, blocsAutorises, digidrive, mur, blocs, activite, titre }
		}
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
