import axios from 'axios'

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
		let nom, langue, digidrive
		const id = params.id
		const mdp = params.mdp
		if (id && id !== '' && mdp && mdp !== '') {
			const rep = await axios.post(hote + '/api/verifier-acces', {
				mur: reponse.data.mur.id,
				identifiant: id,
				motdepasse: atob(mdp)
			})
			if (rep.data.hasOwnProperty('message') && rep.data.message === 'mur_debloque') {
				identifiant = id
				nom = rep.data.nom
				langue = rep.data.langue
				statut = 'auteur'
				digidrive = rep.data.digidrive
			}
		} else {
			nom = pageContext.nom
			langue = pageContext.langue
			digidrive = pageContext.digidrive
		}
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
			const acces = pageContext.acces
			const murs = pageContext.murs
			const mur = reponse.data.mur
			const blocs = reponse.data.blocs
			const activite = reponse.data.activite
			const titre = mur.titre + ' - Digiwall by La Digitale'
			pageProps = { params, hote, userAgent, langues, identifiant, nom, langue, statut, acces, murs, digidrive, mur, blocs, activite, titre }
		}
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
