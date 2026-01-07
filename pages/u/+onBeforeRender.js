export { onBeforeRender }

async function onBeforeRender (pageContext) {
	let pageProps, erreur
	if (pageContext.hasOwnProperty('erreur')) {
		erreur = true
		pageProps = { erreur }
	} else {
		const urlOriginal = pageContext.urlOriginal
		const params = pageContext.params
		const hote = pageContext.hote
		const identifiant = pageContext.identifiant
		const nom = pageContext.nom
		const email = pageContext.email
		const langue = pageContext.langue
		const statut = pageContext.statut
		const affichage = pageContext.affichage
		const classement = pageContext.classement
		const mursCrees = pageContext.mursCrees
		const mursCorbeille = pageContext.mursCorbeille
		const mursRejoints = pageContext.mursRejoints
		const mursAdmins = pageContext.mursAdmins
		const mursFavoris = pageContext.mursFavoris
		const dossiers = pageContext.dossiers
		const titre = identifiant + ' - Digiwall by La Digitale'
		pageProps = { urlOriginal, params, hote, identifiant, nom, email, langue, statut, affichage, classement, mursCrees, mursCorbeille, mursRejoints, mursAdmins, mursFavoris, dossiers, titre }
	}
	return {
		pageContext: {
			pageProps
		}
	}
}
