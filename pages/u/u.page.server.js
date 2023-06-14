import axios from 'axios'

export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps, erreur
	const identifiant = pageContext.routeParams.utilisateur
	const reponse = await axios.post(pageContext.hote + '/api/recuperer-donnees-utilisateur', {
		identifiant: identifiant
	}, {
		headers: { 'Content-Type': 'application/json' }
	}).catch(function () {
		erreur = true
		pageProps = { erreur }
	})
	if (reponse && reponse.hasOwnProperty('data') && identifiant === pageContext.identifiant && pageContext.statut === 'utilisateur') {
		const params = pageContext.params
		const hote = pageContext.hote
		const nom = pageContext.nom
		const email = pageContext.email
		const langue = pageContext.langue
		const statut = pageContext.statut
		const affichage = reponse.data.affichage
		const classement = reponse.data.classement
		const mursCrees = reponse.data.mursCrees
		const mursRejoints = reponse.data.mursRejoints
		const mursAdmins = reponse.data.mursAdmins
		const mursFavoris = reponse.data.mursFavoris
		const dossiers = reponse.data.dossiers
		const titre = identifiant + ' - Digiwall by La Digitale'
		pageProps = { params, hote, identifiant, nom, email, langue, statut, affichage, classement, mursCrees, mursRejoints, mursAdmins, mursFavoris, dossiers, titre }
	} else {
		erreur = true
		pageProps = { erreur }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
