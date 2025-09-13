export { onBeforeRender }

function onBeforeRender (pageContext) {
	const urlOriginal = pageContext.urlOriginal
	const langue = pageContext.langue
	const titre = 'Maintenance - Digiwall by La Digitale'
	const pageProps = { urlOriginal, langue, titre }
	return {
		pageContext: {
			pageProps
		}
	}
}
