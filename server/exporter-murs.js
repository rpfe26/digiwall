require('dotenv').config()
const path = require('path')
const fs = require('fs-extra')
const redis = require('redis')
let db
let db_port = 6379
if (process.env.DB_PORT) {
	db_port = process.env.DB_PORT
}
if (process.env.NODE_ENV === 'production') {
	db = redis.createClient({ host: process.env.DB_HOST, port: db_port, password: process.env.DB_PWD })
} else {
	db = redis.createClient({ port: db_port })
}
const dayjs = require('dayjs')

exporterMursJson(10)

function exporterMursJson (jours) {
	db.get('mur', function (err, mur) {
		const exportMurs = []
		for (let i = 0; i < mur; i++) {
			const exportMur = new Promise(function (resolveExport) {
				const id = i
				const chemin = path.join(__dirname, '..', '/static/murs')
				db.exists('murs:' + id, function (err, resultat) {
					if (err) { resolveExport() }
					if (resultat === 1) {
						db.hgetall('murs:' + id, function (err, donnees) {
							if (err) { resolveExport() }
							if ((donnees.hasOwnProperty('modifie') && dayjs(new Date(donnees.modifie)).isBefore(dayjs().subtract(jours, 'days'))) || (donnees.hasOwnProperty('date') && dayjs(new Date(donnees.date)).isBefore(dayjs().subtract(jours, 'days')))) {
								const donneesMur = new Promise(function (resolveMain) {
									db.hgetall('murs:' + id, function (err, resultats) {
										if (err) { resolveMain({}) }
										resolveMain(resultats)
									})
								})
								const blocsMur = new Promise(function (resolveMain) {
									const donneesBlocs = []
									db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
										if (err) { resolveMain(donneesBlocs) }
										for (const bloc of blocs) {
											const donneesBloc = new Promise(function (resolve) {
												db.hgetall('contenu-blocs:' + id + ':' + bloc, function (err, donnees) {
													if (err) { resolve({}) }
													if (donnees && Object.keys(donnees).length > 0) {
														const donneesCommentaires = []
														db.zrange('commentaires:' + bloc, 0, -1, function (err, commentaires) {
															if (err) { resolve(donnees) }
															for (let commentaire of commentaires) {
																donneesCommentaires.push(JSON.parse(commentaire))
															}
															donnees.commentaires = donneesCommentaires.length
															donnees.listeCommentaires = donneesCommentaires
															db.zrange('evaluations:' + bloc, 0, -1, function (err, evaluations) {
																if (err) { resolve(donnees) }
																const donneesEvaluations = []
																evaluations.forEach(function (evaluation) {
																	donneesEvaluations.push(JSON.parse(evaluation))
																})
																donnees.evaluations = donneesEvaluations.length
																donnees.listeEvaluations = donneesEvaluations
																resolve(donnees)
															})
														})
													} else {
														resolve({})
													}
												})
											})
											donneesBlocs.push(donneesBloc)
										}
										Promise.all(donneesBlocs).then(function (resultat) {
											resolveMain(resultat)
										})
									})
								})
								const activiteMur = new Promise(function (resolveMain) {
									const donneesEntrees = []
									db.zrange('activite:' + id, 0, -1, function (err, entrees) {
										if (err) { resolveMain(donneesEntrees) }
										for (let entree of entrees) {
											entree = JSON.parse(entree)
											const donneesEntree = new Promise(function (resolve) {
												db.exists('utilisateurs:' + entree.identifiant, function (err) {
													if (err) { resolve({}) }
													resolve(entree)
												})
											})
											donneesEntrees.push(donneesEntree)
										}
										Promise.all(donneesEntrees).then(function (resultat) {
											resolveMain(resultat)
										})
									})
								})
								Promise.all([donneesMur, blocsMur, activiteMur]).then(function (donnees) {
									if (donnees.length > 0 && donnees[0].id) {
										const parametres = {}
										parametres.mur = donnees[0]
										parametres.blocs = donnees[1]
										parametres.activite = donnees[2]
										fs.writeFile(path.normalize(chemin + '/' + id + '.json'), JSON.stringify(parametres, '', 4), 'utf8', function (err) {
											if (err) { resolveExport() }
											fs.writeFile(path.normalize(chemin + '/mur-' + id + '.json'), JSON.stringify(parametres.mur, '', 4), 'utf8', function (err) {
												if (err) { resolveExport() }
												console.log(id)
												// Suppression données redis
												db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
													if (err) { resolveExport() }
													const multi = db.multi()
													for (let i = 0; i < blocs.length; i++) {
														multi.del('commentaires:' + blocs[i])
														multi.del('evaluations:' + blocs[i])
														multi.del('contenu-blocs:' + id + ':' + blocs[i])
													}
													multi.del('blocs:' + id)
													multi.del('murs:' + id)
													multi.del('activite:' + id)
													multi.exec(function () {
														resolveExport()
													})
												})
											})
										})
									} else {
										resolveExport()
									}
								})
							} else {
								resolveExport()
							}
						})
					} else {
						resolveExport()
					}
				})
			})
			exportMurs.push(exportMur)
		}
		Promise.all(exportMurs).then(function () {
			console.log('Fin du script')
		})
	})
}
