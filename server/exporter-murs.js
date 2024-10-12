import 'dotenv/config'
import redis from 'redis'
import pg from 'pg'
import dayjs from 'dayjs'
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

const { Client, Query } = pg
const client = new Client({
	user: process.env.PG_DB_USER,
	password: process.env.PG_DB_PWD,
	host: process.env.PG_DB_HOST,
	port: process.env.PG_DB_PORT,
	database: process.env.PG_DB_NAME
})
await client.connect()

exporter(10)

function exporter (jours) {
	db.get('mur', function (err, mur) {
		for (let i = 0; i < mur + 1; i++) {
			const id = i
			const chemin = path.join(__dirname, '..', '/static/murs')
			db.exists('murs:' + id, function (err, resultat) {
				if (resultat === 1) {
					db.hgetall('murs:' + id, function (err, donnees) {
						if ((donnees.hasOwnProperty('modifie') && dayjs(new Date(donnees.modifie)).isBefore(dayjs().subtract(jours, 'days'))) || (donnees.hasOwnProperty('date') && dayjs(new Date(donnees.date)).isBefore(dayjs().subtract(jours, 'days')))) {
							const donneesMur = new Promise(function (resolveMain) {
								db.hgetall('murs:' + id, function (err, resultats) {
									if (err) { resolveMain({}); return false }
									resolveMain(resultats)
								})
							})
							const blocsMur = new Promise(function (resolveMain) {
								const donneesBlocs = []
								db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
									if (err) { resolveMain(donneesBlocs); return false }
									for (const bloc of blocs) {
										const donneesBloc = new Promise(function (resolve) {
											db.hgetall('contenu-blocs:' + id + ':' + bloc, function (err, donnees) {
												if (err) { resolve({}); return false }
												if (donnees && Object.keys(donnees).length > 0) {
													const donneesCommentaires = []
													db.zrange('commentaires:' + bloc, 0, -1, function (err, commentaires) {
														if (err) { resolve(donnees); return false }
														for (let commentaire of commentaires) {
															donneesCommentaires.push(JSON.parse(commentaire))
														}
														donnees.commentaires = donneesCommentaires.length
														donnees.listeCommentaires = donneesCommentaires
														db.zrange('evaluations:' + bloc, 0, -1, function (err, evaluations) {
															if (err) { resolve(donnees); return false }
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
									if (err) { resolveMain(donneesEntrees); return false }
									for (let entree of entrees) {
										entree = JSON.parse(entree)
										const donneesEntree = new Promise(function (resolve) {
											db.exists('utilisateurs:' + entree.identifiant, function (err) {
												if (err) { resolve({}); return false }
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
								if (donnees.length === 3 && donnees[0].id) {
									const date = dayjs().format()
									const requete = new Query('INSERT INTO murs (mur, donnees, blocs, activite, date) VALUES ($1, $2, $3, $4, $5)', [parseInt(id), JSON.stringify(donnees[0]), JSON.stringify(donnees[1]), JSON.stringify(donnees[2]), date])
									client.query(requete)
									requete.on('end', function () {
										// Suppression données redis
										db.zrange('blocs:' + id, 0, -1, function (err, blocs) {
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
												console.log(id)
											})
										})
									})
									
									requete.on('error', function () {
										console.log('erreur : pad-' + id)
									})
								}
							})
						}
					})
				}
			})
		}
	})
}
