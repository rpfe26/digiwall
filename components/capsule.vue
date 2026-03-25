<template>
	<div class="contenu" v-if="item.visibilite !== 'protegee' || blocsAutorises.includes(item.bloc)">
		<div class="titre" v-if="item.titre !== ''" :style="{'background': parent.eclaircirCouleur(item.couleur)}">
			<span>{{ item.titre }}</span>
			<i class="material-icons" aria-hidden="true" v-if="action === 'organiser' && (mur.epinglage === 'desactive' || (mur.epinglage === 'active' && (!item.epinglee || item.epinglee === 'non')))">drag_indicator</i>
		</div>
		<div class="texte" v-if="item.texte !== ''" v-html="item.texte" />
		<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
			<img role="button" :tabindex="tabindex" :title="$t('afficherDansVisionneuse')" :aria-label="$t('afficherDansVisionneuse')" v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="parent.definirCheminFichiers() + '/' + mur.id + '/' + item.media" loading="lazy" :alt="item.media" @click="parent.afficherVisionneuse(item)" @keydown.enter.space.prevent="parent.afficherVisionneuse(item)">
			<img role="button" :tabindex="tabindex" :title="$t('afficherDansVisionneuse')" :aria-label="$t('afficherDansVisionneuse')" v-else-if="item.type === 'lien-image'" :src="item.media" loading="lazy" :alt="item.media" @click="parent.afficherVisionneuse(item)" @keydown.enter.space.prevent="parent.afficherVisionneuse(item)">
			<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="parent.definirCheminFichiers() + '/' + mur.id + '/' + item.media"></audio>
			<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="parent.definirCheminFichiers() + '/' + mur.id + '/' + item.media"></video>
			<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allow="autoplay; fullscreen"></iframe>
			<span role="button" :tabindex="tabindex" :title="$t('afficherDansVisionneuse')" :aria-label="$t('afficherDansVisionneuse')" v-else-if="item.type === 'audio' || item.type === 'video' || (item.type === 'document' && visionneuseDocx !== '') || item.type === 'pdf' || (item.type === 'office' && visionneuseDocx !== '') || item.type === 'embed' || item.typeBloc === 'galerie'" @click="parent.afficherVisionneuse(item)" @keydown.enter.space.prevent="parent.afficherVisionneuse(item)"><img :class="{'vignette': parent.definirVignette(item).substring(0, 5) !== '/img/'}" :src="parent.definirVignette(item)" :alt="parent.definirNomLienFichier(parent.definirVignette(item))" loading="lazy"></span>
			<span v-else-if="item.type === 'lien'"><a :href="item.media" target="_blank"><img :class="{'vignette': parent.definirVignette(item).substring(0, 5) !== '/img/'}" :src="parent.definirVignette(item)" :alt="parent.definirNomLienFichier(parent.definirVignette(item))" loading="lazy"></a></span>
			<span v-else><a :href="parent.definirCheminFichiers() + '/' + mur.id + '/' + item.media" download><img :class="{'vignette': parent.definirVignette(item).substring(0, 5) !== '/img/'}" :src="parent.definirVignette(item)" :alt="parent.definirNomLienFichier(parent.definirVignette(item))" loading="lazy"></a></span>
			<audio v-if="item.typeBloc === 'image-audio'" controls preload="metadata" :src="parent.definirCheminFichiers() + '/' + mur.id + '/' + item.mediaExtra"></audio>
		</div>
		<div class="evaluation" v-if="mur.evaluations === 'activees'">
			<span class="etoiles" :title="definirEtoiles(item.evaluations)">
				<i class="material-icons" aria-hidden="true" :class="{'evalue': parent.verifierUtilisateurEvaluation(item.evaluations) === true}" v-for="etoile in parent.definirEvaluationCapsule(item.evaluations)" :key="'etoilepleine_' + etoile">star</i>
				<i class="material-icons" aria-hidden="true" :class="{'evalue': parent.verifierUtilisateurEvaluation(item.evaluations) === true}" v-for="etoile in (5 - parent.definirEvaluationCapsule(item.evaluations))" :key="'etoilevide_' + etoile">star_outline</i>
				<span>({{ item.evaluations.length }})</span>
			</span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('evaluerCapsule')" :aria-label="$t('evaluerCapsule')" @click="parent.ouvrirModaleEvaluations(item.bloc, item.titre, '')" @keydown.enter.space.prevent="parent.ouvrirModaleEvaluations(item.bloc, item.titre, '')" v-if="action !== 'organiser' && parent.verifierUtilisateurEvaluation(item.evaluations) === false"><i class="material-icons" aria-hidden="true">add_comment</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('evaluerCapsule')" :aria-label="$t('evaluerCapsule')" @click="parent.ouvrirModaleEvaluations(item.bloc, item.titre, item.evaluations)" @keydown.enter.space.prevent="parent.ouvrirModaleEvaluations(item.bloc, item.titre, item.evaluations)" v-else-if="action !== 'organiser' && parent.verifierUtilisateurEvaluation(item.evaluations) === true"><i class="material-icons" aria-hidden="true">rate_review</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-if="action !== 'organiser'">
			<span class="cadenas" :title="$t('capsuleVerrouillee')" v-if="(item.identifiant === identifiant || mur.contributions === 'modifiables') && item.edition === 'non' && !admin && mur.verrouillage === 'active'"><i class="material-icons" aria-hidden="true">lock</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('verrouillerCapsule')" :aria-label="$t('verrouillerCapsule')" @click="parent.verrouillerBloc(item.bloc)" @keydown.enter.space.prevent="parent.verrouillerBloc(item.bloc)" v-if="item.edition === 'oui' && admin && !admins.includes(item.identifiant) && item.identifiant !== identifiant && item.identifiant !== mur.identifiant && mur.verrouillage === 'active'"><i class="material-icons" aria-hidden="true">lock</i></span>
			<span class="bouton cadenas" role="button" :tabindex="tabindex" :title="$t('deverrouillerCapsule')" :aria-label="$t('deverrouillerCapsule')" @click="parent.deverrouillerBloc(item.bloc)" @keydown.enter.space.prevent="parent.deverrouillerBloc(item.bloc)" v-else-if="item.edition === 'non' && admin && !admins.includes(item.identifiant) && item.identifiant !== identifiant && item.identifiant !== mur.identifiant && mur.verrouillage === 'active'"><i class="material-icons" aria-hidden="true">lock_open</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('modifierCapsule')" :aria-label="$t('modifierCapsule')" @click="parent.ouvrirModaleBloc('edition', item, indexCol)" @keydown.enter.space.prevent="parent.ouvrirModaleBloc('edition', item, indexCol)" v-if="((item.identifiant === identifiant || mur.contributions === 'modifiables') && ((item.edition === 'oui' && mur.verrouillage === 'active') || mur.verrouillage === 'desactive')) || admin"><i class="material-icons" aria-hidden="true">edit</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" :aria-label="$t('commenterCapsule')" @click="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons" aria-hidden="true">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('epinglerCapsule')" :aria-label="$t('epinglerCapsule')" @click="parent.epinglerBloc(item.bloc)" @keydown.enter.space.prevent="parent.epinglerBloc(item.bloc)" v-if="admin && mur.epinglage === 'active' && (!item.epinglee || item.epinglee === 'non')"><i class="material-icons" aria-hidden="true">push_pin</i></span>
			<span class="bouton epinglee" role="button" :tabindex="tabindex" :title="$t('desepinglerCapsule')" :aria-label="$t('desepinglerCapsule')" @click="parent.desepinglerBloc(item.bloc)" @keydown.enter.space.prevent="parent.desepinglerBloc(item.bloc)" v-else-if="admin && mur.epinglage === 'active' && item.epinglee === 'oui'"><i class="material-icons" aria-hidden="true">push_pin</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('copierCapsule')" :aria-label="$t('copierCapsule')" @click="parent.afficherEnvoyerBloc(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.afficherEnvoyerBloc(item.bloc, item.titre)" v-if="admin && mur.copieBloc === 'activee' && (statut === 'utilisateur' || viaDigidrive)"><i class="material-icons" aria-hidden="true">send</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :aria-label="$t('informationsCapsule')" :data-description="parent.definirDescription(item)"><i class="material-icons" aria-hidden="true">info</i></span>
			<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons" aria-hidden="true">{{ parent.definirIconeMedia(item) }}</i></span>
			<span class="bouton supprimer" role="button" :tabindex="tabindex" :title="$t('supprimerCapsule')" :aria-label="$t('supprimerCapsule')" @click="parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" @keydown.enter.space.prevent="parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" v-if="(item.identifiant === identifiant && item.edition === 'oui') || admin"><i class="material-icons" aria-hidden="true">delete</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-else>
			<span class="cadenas" :title="$t('capsuleVerrouillee')" v-if="item.identifiant !== identifiant && !admins.includes(item.identifiant) && item.edition === 'non' && mur.verrouillage === 'active'"><i class="material-icons" aria-hidden="true">lock</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" :aria-label="$t('commenterCapsule')" @click="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons" aria-hidden="true">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="epinglee" :title="$t('capsuleEpinglee')" v-if="admin && mur.epinglage === 'active' && item.epinglee === 'oui'"><i class="material-icons" aria-hidden="true">push_pin</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :aria-label="$t('informationsCapsule')" :data-description="parent.definirDescription(item)"><i class="material-icons" aria-hidden="true">info</i></span>
			<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons" aria-hidden="true">{{ parent.definirIconeMedia(item) }}</i></span>
		</div>
		<div class="moderation" v-if="item.visibilite === 'privee' && admin">
			<span class="bouton" role="button" :tabindex="tabindex" @click="parent.autoriserBloc(item, 'privee')" @keydown.enter.space.prevent="parent.autoriserBloc(item, 'privee')">{{ $t('afficherCapsule') }}</span>
		</div>
		<div class="moderation" v-else-if="mur.contributions === 'moderees' && item.visibilite === 'masquee'">
			<span class="bouton" role="button" :tabindex="tabindex" @click="parent.autoriserBloc(item, 'moderee')" @keydown.enter.space.prevent="parent.autoriserBloc(item, 'moderee')" v-if="admin">{{ $t('validerCapsule') }}</span>
			<span class="bouton" v-else-if="item.identifiant === identifiant">{{ $t('enAttenteModeration') }}</span>
		</div>
	</div>
	<div class="contenu" v-else>
		<div class="titre" v-if="item.titre !== ''" :style="{'background': parent.eclaircirCouleur(item.couleur), 'border-bottom': '1px dotted ' + item.couleur}">
			<span>{{ item.titre }}</span>
		</div>
		<div class="cadenas" :title="$t('capsuleProtegee')" :style="{'background': parent.eclaircirCouleur(item.couleur)}">
			<i class="material-icons" aria-hidden="true">lock_outline</i>
		</div>
		<div class="motdepasse" role="form" :aria-label="$t('verifierMotDePasse')">
			<input type="text" :placeholder="$t('motDePasse')" @keydown.enter="parent.verifierMotDePasseBloc(item.bloc, indexCol)">
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('verifierMotDePasse')" :aria-label="$t('verifierMotDePasse')" @click="parent.verifierMotDePasseBloc(item.bloc, indexCol)" @keydown.enter.space.prevent="parent.verifierMotDePasseBloc(item.bloc, indexCol)"><i class="material-icons" aria-hidden="true">done</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-if="action !== 'organiser'">
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('modifierCapsule')" :aria-label="$t('modifierCapsule')" @click="parent.ouvrirModaleBloc('edition', item, indexCol)" @keydown.enter.space.prevent="parent.ouvrirModaleBloc('edition', item, indexCol)" v-if="admin"><i class="material-icons" aria-hidden="true">edit</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" :aria-label="$t('commenterCapsule')" @click="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons" aria-hidden="true">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('copierCapsule')" :aria-label="$t('copierCapsule')" @click="parent.afficherEnvoyerBloc(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.afficherEnvoyerBloc(item.bloc, item.titre)" v-if="admin && mur.copieBloc === 'activee' && (statut === 'utilisateur' || viaDigidrive)"><i class="material-icons" aria-hidden="true">send</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :aria-label="$t('informationsCapsule')" :data-description="parent.definirDescription(item)"><i class="material-icons" aria-hidden="true">info</i></span>
			<span class="bouton supprimer" role="button" :tabindex="tabindex" :title="$t('supprimerCapsule')" :aria-label="$t('supprimerCapsule')" @click="parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" @keydown.enter.space.prevent="parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" v-if="admin"><i class="material-icons" aria-hidden="true">delete</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-else>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" :aria-label="$t('commenterCapsule')" @click="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter.space.prevent="parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons" aria-hidden="true">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :aria-label="$t('informationsCapsule')" :data-description="parent.definirDescription(item)"><i class="material-icons" aria-hidden="true">info</i></span>
		</div>
	</div>
</template>

<script>
export default {
	name: 'Capsule',
	props: {
		admin: Boolean,
		identifiant: String,
		item: Object,
		mur: Object,
		blocsAutorises: Array,
		admins: Array,
		indexCol: Number,
		tabindex: Number,
		action: String,
		statut: String,
		type: String,
		viaDigidrive: Boolean
	},
	data () {
		return {
			parent: '',
			visionneuseDocx: import.meta.env.VITE_DOCX_VIEWER
		}
	},
	created () {
		if (this.type === 'simple') {
			this.parent = this.$parent
		} else {
			this.parent = this.$parent.$parent
		}
	},
	methods: {
		definirEtoiles (evaluations) {
			const etoiles = this.parent.definirEvaluationCapsule(evaluations) > 1 ? this.parent.definirEvaluationCapsule(evaluations) + ' ' + this.$t('etoiles') : this.parent.definirEvaluationCapsule(evaluations) + ' ' + this.$t('etoile')
			return etoiles + ' - ' + evaluations.length + ' ' + this.$t('evaluations').toLowerCase()
		}
	}
}
</script>
