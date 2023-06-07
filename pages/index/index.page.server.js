export { onBeforeRender }

function onBeforeRender (pageContext) {
	const params = pageContext.params
	const hote = pageContext.hote
	const langues = pageContext.langues
	const langue = pageContext.langue
	const titre = 'Digiwall by La Digitale'
	const pageProps = { params, hote, langues, langue, titre }
	return {
		pageContext: {
			pageProps
		}
	}
}
