<template>
	<div class="contenu" v-if="item.visibilite !== 'protegee' || blocsAutorises.includes(item.bloc)">
		<div class="titre" v-if="item.titre !== ''" :style="{'background': $parent.$parent.eclaircirCouleur(item.couleur)}">
			<span>{{ item.titre }}</span>
			<i class="material-icons" v-if="action === 'organiser' && (mur.epinglage === 'desactive' || (mur.epinglage === 'active' && item.epinglee === 'non'))">drag_indicator</i>
		</div>
		<div class="texte" v-if="item.texte !== ''" v-html="item.texte" />
		<div class="media" :class="{'iframe-video': item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')}" v-if="item.media !== '' || item.medias.length > 0">
			<img role="button" :tabindex="tabindex" v-if="item.type === 'image' || item.typeBloc === 'image-audio'" :src="'/' + $parent.$parent.definirDossierFichiers(mur.id) + '/' + mur.id + '/' + item.media" loading="lazy" :alt="item.media" @click="$parent.$parent.afficherVisionneuse(item)" @keydown.enter="$parent.$parent.afficherVisionneuse(item)">
			<img role="button" :tabindex="tabindex" v-else-if="item.type === 'lien-image'" :src="item.media" loading="lazy" :alt="item.media" @click="$parent.$parent.afficherVisionneuse(item)" @keydown.enter="$parent.$parent.afficherVisionneuse(item)">
			<audio v-else-if="item.type === 'audio' && item.vignetteActivee === 'non'" controls preload="metadata" :src="'/' + $parent.$parent.definirDossierFichiers(mur.id) + '/' + mur.id + '/' + item.media"></audio>
			<video v-else-if="item.type === 'video' && item.vignetteActivee === 'non'" controls playsinline crossOrigin="anonymous" :src="'/' + $parent.$parent.definirDossierFichiers(mur.id) + '/' + mur.id + '/' + item.media"></video>
			<iframe v-else-if="item.type === 'embed' && item.vignetteActivee === 'non' && (item.source === 'digiview' || item.source === 'peertube' || item.source === 'youtube' || item.source === 'vimeo' || item.source === 'dailymotion' || item.source === 'soundcloud')" :src="item.iframe" allow="autoplay; fullscreen"></iframe>
			<span role="button" :tabindex="tabindex" v-else-if="item.type === 'audio' || item.type === 'video' || item.type === 'document' || item.type === 'pdf' || item.type === 'office' || item.type === 'embed' || item.typeBloc === 'galerie'" @click="$parent.$parent.afficherVisionneuse(item)" @keydown.enter="$parent.$parent.afficherVisionneuse(item)"><img :class="{'vignette': $parent.$parent.definirVignette(item).substring(0, 5) !== '/img/'}" :src="$parent.$parent.definirVignette(item)" :alt="$parent.$parent.definirVignette(item)" loading="lazy"></span>
			<span v-else-if="item.type === 'lien'"><a :href="item.media" target="_blank"><img :class="{'vignette': $parent.$parent.definirVignette(item).substring(0, 5) !== '/img/'}" :src="$parent.$parent.definirVignette(item)" :alt="$parent.$parent.definirVignette(item)" loading="lazy"></a></span>
			<span v-else><a :href="'/' + $parent.$parent.definirDossierFichiers(mur.id) + '/' + mur.id + '/' + item.media" download><img :class="{'vignette': definirVignette(item).substring(0, 5) !== '/img/'}" :src="$parent.$parent.definirVignette(item)" :alt="$parent.$parent.definirVignette(item)" loading="lazy"></a></span>
			<audio v-if="item.typeBloc === 'image-audio'" controls preload="metadata" :src="'/' + $parent.$parent.definirDossierFichiers(mur.id) + '/' + mur.id + '/' + item.mediaExtra"></audio>
		</div>
		<div class="evaluation" v-if="mur.evaluations === 'activees'">
			<span class="etoiles">
				<i class="material-icons" :class="{'evalue': $parent.$parent.verifierUtilisateurEvaluation(item.evaluations) === true}" v-for="etoile in $parent.$parent.definirEvaluationCapsule(item.evaluations)" :key="'etoilepleine_' + etoile">star</i>
				<i class="material-icons" :class="{'evalue': $parent.$parent.verifierUtilisateurEvaluation(item.evaluations) === true}" v-for="etoile in (5 - $parent.$parent.definirEvaluationCapsule(item.evaluations))" :key="'etoilevide_' + etoile">star_outline</i>
				<span>({{ item.evaluations.length }})</span>
			</span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('evaluerCapsule')" @click="$parent.$parent.ouvrirModaleEvaluations(item.bloc, item.titre, '')" @keydown.enter="$parent.$parent.ouvrirModaleEvaluations(item.bloc, item.titre, '')" v-if="action !== 'organiser' && $parent.$parent.verifierUtilisateurEvaluation(item.evaluations) === false"><i class="material-icons">add_comment</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('evaluerCapsule')" @click="$parent.$parent.ouvrirModaleEvaluations(item.bloc, item.titre, item.evaluations)" @keydown.enter="$parent.$parent.ouvrirModaleEvaluations(item.bloc, item.titre, item.evaluations)" v-else-if="action !== 'organiser' && $parent.$parent.verifierUtilisateurEvaluation(item.evaluations) === true"><i class="material-icons">rate_review</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-if="action !== 'organiser'">
			<span class="cadenas" :title="$t('capsuleVerrouillee')" v-if="(item.identifiant === identifiant || mur.contributions === 'modifiables') && item.edition === 'non' && !admin && mur.verrouillage === 'active'"><i class="material-icons">lock</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('verrouillerCapsule')" @click="$parent.$parent.verrouillerBloc(item.bloc)" @keydown.enter="$parent.$parent.verrouillerBloc(item.bloc)" v-if="item.edition === 'oui' && admin && !admins.includes(item.identifiant) && item.identifiant !== identifiant && item.identifiant !== mur.identifiant && mur.verrouillage === 'active'"><i class="material-icons">lock</i></span>
			<span class="bouton cadenas" role="button" :tabindex="tabindex" :title="$t('deverrouillerCapsule')" @click="$parent.$parent.deverrouillerBloc(item.bloc)" @keydown.enter="$parent.$parent.deverrouillerBloc(item.bloc)" v-else-if="item.edition === 'non' && admin && !admins.includes(item.identifiant) && item.identifiant !== identifiant && item.identifiant !== mur.identifiant && mur.verrouillage === 'active'"><i class="material-icons">lock_open</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('modifierCapsule')" @click="$parent.$parent.ouvrirModaleBloc('edition', item, indexCol)" @keydown.enter="$parent.$parent.ouvrirModaleBloc('edition', item, indexCol)" v-if="((item.identifiant === identifiant || mur.contributions === 'modifiables') && ((item.edition === 'oui' && mur.verrouillage === 'active') || mur.verrouillage === 'desactive')) || admin"><i class="material-icons">edit</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" @click="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('epinglerCapsule')" @click="$parent.$parent.epinglerBloc(item.bloc)" @keydown.enter="$parent.$parent.epinglerBloc(item.bloc)" v-if="admin && mur.epinglage === 'active' && item.epinglee === 'non'"><i class="material-icons">push_pin</i></span>
			<span class="bouton epinglee" role="button" :tabindex="tabindex" :title="$t('desepinglerCapsule')" @click="$parent.$parent.desepinglerBloc(item.bloc)" @keydown.enter="$parent.$parent.desepinglerBloc(item.bloc)" v-else-if="admin && mur.epinglage === 'active' && item.epinglee === 'oui'"><i class="material-icons">push_pin</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('copierCapsule')" @click="$parent.$parent.afficherEnvoyerBloc(item.bloc, item.titre)" @keydown.enter="$parent.$parent.afficherEnvoyerBloc(item.bloc, item.titre)" v-if="admin && mur.copieBloc === 'activee' && (statut === 'utilisateur' || digidrive)"><i class="material-icons">send</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :data-description="$parent.$parent.definirDescription(item)"><i class="material-icons">info</i></span>
			<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons">{{ $parent.$parent.definirIconeMedia(item) }}</i></span>
			<span class="bouton supprimer" role="button" :tabindex="tabindex" :title="$t('supprimerCapsule')" @click="$parent.$parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" @keydown.enter="$parent.$parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" v-if="(item.identifiant === identifiant && item.edition === 'oui') || admin"><i class="material-icons">delete</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-else>
			<span class="cadenas" :title="$t('capsuleVerrouillee')" v-if="item.identifiant !== identifiant && !admins.includes(item.identifiant) && item.edition === 'non' && mur.verrouillage === 'active'"><i class="material-icons">lock</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" @click="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="epinglee" :title="$t('capsuleEpinglee')" v-if="admin && mur.epinglage === 'active' && item.epinglee === 'oui'"><i class="material-icons">push_pin</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :data-description="$parent.$parent.definirDescription(item)"><i class="material-icons">info</i></span>
			<span class="media-type" v-if="item.media !== '' || item.medias.length > 0"><i class="material-icons">{{ $parent.$parent.definirIconeMedia(item) }}</i></span>
		</div>
		<div class="moderation" v-if="item.visibilite === 'privee' && admin">
			<span class="bouton" role="button" :tabindex="tabindex" @click="$parent.$parent.autoriserBloc(item, 'privee')" @keydown.enter="$parent.$parent.autoriserBloc(item, 'privee')">{{ $t('afficherCapsule') }}</span>
		</div>
		<div class="moderation" v-else-if="mur.contributions === 'moderees' && item.visibilite === 'masquee'">
			<span class="bouton" role="button" :tabindex="tabindex" @click="$parent.$parent.autoriserBloc(item, 'moderee')" @keydown.enter="$parent.$parent.autoriserBloc(item, 'moderee')" v-if="admin">{{ $t('validerCapsule') }}</span>
			<span class="bouton" v-else-if="item.identifiant === identifiant">{{ $t('enAttenteModeration') }}</span>
		</div>
	</div>
	<div class="contenu" v-else>
		<div class="titre" v-if="item.titre !== ''" :style="{'background': $parent.$parent.eclaircirCouleur(item.couleur), 'border-bottom': '1px dotted ' + item.couleur}">
			<span>{{ item.titre }}</span>
		</div>
		<div class="cadenas" :style="{'background': $parent.$parent.eclaircirCouleur(item.couleur)}">
			<i class="material-icons">lock_outline</i>
		</div>
		<div class="motdepasse">
			<input type="text" :placeholder="$t('motDePasse')" @keydown.enter="$parent.$parent.verifierMotDePasseBloc(item.bloc, indexCol)">
			<span class="bouton"  role="button" :tabindex="tabindex" @click="$parent.$parent.verifierMotDePasseBloc(item.bloc, indexCol)" @keydown.enter="$parent.$parent.verifierMotDePasseBloc(item.bloc, indexCol)"><i class="material-icons">done</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-if="action !== 'organiser'">
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('modifierCapsule')" @click="$parent.$parent.ouvrirModaleBloc('edition', item, indexCol)" @keydown.enter="$parent.$parent.ouvrirModaleBloc('edition', item, indexCol)" v-if="admin"><i class="material-icons">edit</i></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" @click="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('copierCapsule')" @click="$parent.$parent.afficherEnvoyerBloc(item.bloc, item.titre)" @keydown.enter="$parent.$parent.afficherEnvoyerBloc(item.bloc, item.titre)" v-if="admin && mur.copieBloc === 'activee' && (statut === 'utilisateur' || digidrive)"><i class="material-icons">send</i></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :data-description="$parent.$parent.definirDescription(item)"><i class="material-icons">info</i></span>
			<span class="bouton supprimer"  role="button" :tabindex="tabindex" :title="$t('supprimerCapsule')" @click="$parent.$parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" @keydown.enter="$parent.$parent.afficherSupprimerBloc(item.bloc, item.titre, indexCol)" v-if="admin"><i class="material-icons">delete</i></span>
		</div>
		<div class="action" :style="{'color': item.couleur}" v-else>
			<span class="bouton" role="button" :tabindex="tabindex" :title="$t('commenterCapsule')" @click="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" @keydown.enter="$parent.$parent.ouvrirModaleCommentaires(item.bloc, item.titre)" v-if="mur.commentaires === 'actives'"><i class="material-icons">comment</i><span class="badge">{{ item.commentaires }}</span></span>
			<span class="bouton info" role="button" :tabindex="tabindex" :title="$t('informationsCapsule')" :data-description="$parent.$parent.definirDescription(item)"><i class="material-icons">info</i></span>
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
		digidrive: Boolean
	}
}
</script>
