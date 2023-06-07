export { onBeforeRender }

function onBeforeRender (pageContext) {
	const langue = pageContext.langue
	const titre = 'Maintenance - Digiwall by La Digitale'
	const pageProps = { langue, titre }
	return {
		pageContext: {
			pageProps
		}
	}
}
