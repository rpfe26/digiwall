<template>
	<div id="page" v-if="identifiant !== '' && statut === 'utilisateur'">
		<header>
			<span id="conteneur-logo">
				<span id="logo" />
			</span>
			<span id="titre">{{ $t('monCompte') }}</span>
		</header>

		<nav id="nav">
			<span id="compte" role="button" :tabindex="definirTabIndex()" :title="$t('parametresCompte')" @click="gererMenu" @keydown.enter="gererMenu"><i class="material-icons">account_circle</i></span>
			<span id="deconnexion" role="button" :tabindex="definirTabIndex()" :title="$t('deconnexion')" @click="deconnexion" @keydown.enter="deconnexion"><i class="material-icons">power_settings_new</i></span>
		</nav>

		<div class="menu gauche" v-if="menu" role="menu">
			<div class="en-tete">
				<span class="titre">{{ $t('parametresCompte') }}</span>
				<span class="fermer" role="button" :tabindex="definirTabIndex()" @click="fermerMenu" @keydown.enter="fermerMenu"><i class="material-icons">close</i></span>
			</div>
			<div class="contenu ascenseur">
				<div class="conteneur">
					<label>{{ $t('langue') }}</label>
					<div id="langues">
						<span role="button" :tabindex="definirTabIndex()" :class="{'selectionne': langue === 'fr'}" @click="modifierLangue('fr')" @keydown.enter="modifierLangue('fr')">FR</span>
						<span role="button" :tabindex="definirTabIndex()" :class="{'selectionne': langue === 'es'}" @click="modifierLangue('es')" @keydown.enter="modifierLangue('es')">ES</span>
						<span role="button" :tabindex="definirTabIndex()" :class="{'selectionne': langue === 'it'}" @click="modifierLangue('it')" @keydown.enter="modifierLangue('it')">IT</span>
						<span role="button" :tabindex="definirTabIndex()" :class="{'selectionne': langue === 'de'}" @click="modifierLangue('de')" @keydown.enter="modifierLangue('de')">DE</span>
						<span role="button" :tabindex="definirTabIndex()" :class="{'selectionne': langue === 'en'}" @click="modifierLangue('en')" @keydown.enter="modifierLangue('en')">EN</span>
					</div>
				</div>
				<div class="conteneur">
					<label for="identifiant">{{ $t('identifiant') }}</label>
					<input id="identifiant" type="text" readonly :value="identifiant">
				</div>
				<div class="conteneur">
					<label for="nom">{{ $t('nom') }}</label>
					<input id="nom" type="text" maxlength="48" :value="nom" @keydown.enter="modifierInformations">
				</div>
				<div class="conteneur">
					<label for="email">{{ $t('email') }}</label>
					<input id="email" type="text" :value="email" @keydown.enter="modifierInformations">
				</div>
				<div class="conteneur conteneur-bouton">
					<span class="bouton-vert" role="button" :tabindex="definirTabIndex()" @click="modifierInformations" @keydown.enter="modifierInformations">{{ $t('enregistrer') }}</span>
				</div>
				<div class="conteneur conteneur-bouton">
					<span class="bouton-bleu" role="button" :tabindex="definirTabIndex()" @click="afficherModaleMotDePasse" @keydown.enter="afficherModaleMotDePasse">{{ $t('modifierMotDePasse') }}</span>
				</div>
				<div class="conteneur conteneur-bouton">
					<span class="bouton-rouge" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, '', 'supprimer-compte')" @keydown.enter="afficherModaleConfirmation($event, '', 'supprimer-compte')">{{ $t('supprimerCompte') }}</span>
				</div>
			</div>
		</div>

		<div id="onglets" class="ascenseur">
			<div class="onglet" role="button" :tabindex="definirTabIndex()" :class="{'actif': onglet === 'murs-crees'}" @click="modifierOnglet('murs-crees')" @keydown.enter="modifierOnglet('murs-crees')">
				<span>{{ $t('mursCrees') }}</span>
				<span class="badge">{{ mursCrees.length }}</span>
			</div>
			<div class="onglet" role="button" :tabindex="definirTabIndex()" :class="{'actif': onglet === 'murs-rejoints'}" @click="modifierOnglet('murs-rejoints')" @keydown.enter="modifierOnglet('murs-rejoints')">
				<span>{{ $t('mursRejoints') }}</span>
				<span class="badge">{{ mursRejoints.length }}</span>
			</div>
			<div class="onglet" role="button" :tabindex="definirTabIndex()" :class="{'actif': onglet === 'murs-admins'}" @click="modifierOnglet('murs-admins')" @keydown.enter="modifierOnglet('murs-admins')">
				<span>{{ $t('mursAdmins') }}</span>
				<span class="badge">{{ mursAdmins.length }}</span>
			</div>
			<div class="onglet" role="button" :tabindex="definirTabIndex()" :class="{'actif': onglet === 'murs-favoris'}" @click="modifierOnglet('murs-favoris')" @keydown.enter="modifierOnglet('murs-favoris')">
				<span>{{ $t('favoris') }}</span>
				<span class="badge">{{ mursFavoris.length }}</span>
			</div>
			<div class="onglet" role="button" :tabindex="definirTabIndex()" v-for="(item, indexItem) in dossiers" :class="{'actif': onglet === item.id}" @click="modifierOnglet(item.id)" @keydown.enter="modifierOnglet(item.id)" :key="'dossier_' + indexItem">
				<span>{{ item.nom }}</span>
				<span class="badge">{{ item.murs.length }}</span>
				<div class="menu-dossier">
					<span class="bouton" role="button" :tabindex="definirTabIndex()" :title="$t('modifierDossier')" @click="afficherModaleModifierDossier($event, item.id)" @keydown.enter="afficherModaleModifierDossier($event, item.id)"><i class="material-icons">edit</i></span>
					<span class="bouton supprimer" role="button" :tabindex="definirTabIndex()" :title="$t('supprimerDossier')" @click="afficherModaleConfirmation($event, item.id, 'supprimer-dossier')" @keydown.enter="afficherModaleConfirmation($event, item.id, 'supprimer-dossier')"><i class="material-icons">delete</i></span>
				</div>
			</div>
			<span class="bouton-ajouter" role="button" :tabindex="definirTabIndex()" @click="afficherModaleAjouterDossier" @keydown.enter="afficherModaleAjouterDossier">{{ $t('ajouterDossier') }}</span>
		</div>

		<div id="murs" class="ascenseur" :class="affichage">
			<div class="section">
				<div id="boutons">
					<span id="bouton-creer" role="button" :tabindex="definirTabIndex()" :class="{'desactive': mursCrees.length >= limite}" @click="afficherModaleCreerMur" @keydown.enter="afficherModaleCreerMur">{{ $t('creerMur') }}</span>
					<span id="bouton-importer" role="button" :tabindex="definirTabIndex()" :class="{'desactive': mursCrees.length >= limite}" @click="afficherModaleImporterMur" @keydown.enter="afficherModaleImporterMur">{{ $t('importerMur') }}</span>
				</div>
				<div id="afficher">
					<div class="rechercher">
						<span><i class="material-icons">search</i></span>
						<input type="search" v-model.lazy="requete" :placeholder="$t('rechercher')">
					</div>
					<div class="classer">
						<span><i class="material-icons">sort</i></span>
						<select id="champ-classer" @change="modifierClassement($event.target.value)">
							<option value="date-asc" :selected="classement === 'date-asc'">{{ $t('dateAsc') }}</option>
							<option value="date-desc" :selected="classement === 'date-desc'">{{ $t('dateDesc') }}</option>
							<option value="alpha-asc" :selected="classement === 'alpha-asc'">{{ $t('alphaAsc') }}</option>
							<option value="alpha-desc" :selected="classement === 'alpha-desc'">{{ $t('alphaDesc') }}</option>
						</select>
					</div>
					<div class="afficher">
						<span role="button" :tabindex="definirTabIndex()" :title="$t('affichageListe')" @click="modifierAffichage('liste')" @keydown.enter="modifierAffichage('liste')"><i class="material-icons">view_list</i></span>
						<span role="button" :tabindex="definirTabIndex()" :title="$t('affichageMosaique')" @click="modifierAffichage('mosaique')" @keydown.enter="modifierAffichage('mosaique')"><i class="material-icons">view_module</i></span>
					</div>
				</div>
				<div id="actions-dossier" v-if="onglet !== 'murs-crees' && onglet !== 'murs-rejoints' && onglet !== 'murs-admins' && onglet !== 'murs-favoris'">
					<div class="conteneur">
						<label>{{ $t('actionsDossier') }}</label>
						<span role="button" :tabindex="definirTabIndex()" class="bouton" :title="$t('modifierDossier')" @click="afficherModaleModifierDossier($event, onglet)" @keydown.enter="afficherModaleModifierDossier($event, onglet)"><i class="material-icons">edit</i></span>
						<span role="button" :tabindex="definirTabIndex()" class="bouton supprimer" :title="$t('supprimerDossier')" @click="afficherModaleConfirmation($event, onglet, 'supprimer-dossier')" @keydown.enter="afficherModaleConfirmation($event, onglet, 'supprimer-dossier')"><i class="material-icons">delete</i></span>
					</div>
				</div>
				<div class="murs" v-if="murs.length > 0 && requete === ''">
					<template v-for="(mur, indexMur) in murs">
						<div :id="'mur-' + mur.id" class="mur liste" v-if="affichage === 'liste'" :key="'mur_liste_' + indexMur">
							<a class="fond" :href="'/w/' + mur.id + '/' + mur.token + '/' + definirSlug(mur.titre)" :class="{'fond-personnalise': mur.fond.substring(1, 9) === 'fichiers'}" :style="definirFond(mur.fond)" />
							<a class="meta" :class="{'mur-rejoint': mur.identifiant !== identifiant, 'deplacer': dossiers.length > 0}" :href="'/w/' + mur.id + '/' + mur.token + '/' + definirSlug(mur.titre)">
								<span class="mise-a-jour" v-if="mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)" />
								<span class="titre">{{ mur.titre }}</span>
								<span class="date">{{ $t('creeLe') }} {{ $formaterDate(mur.date, langue) }}</span>
								<span class="auteur" v-if="mur.identifiant !== identifiant">&nbsp;{{ $t('par') }} {{ mur.identifiant }}</span>
								<span class="vues" v-if="mur.vues > 1"> - {{ mur.vues }} {{ $t('vues') }}</span>
								<span class="vues" v-else> - {{ mur.vues }} {{ $t('vue') }}</span>
							</a>
							<div class="actions" v-if="mur.identifiant === identifiant">
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="dupliquer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'dupliquer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'dupliquer')" :title="$t('dupliquerMur')"><i class="material-icons">content_copy</i></span>
								<span class="exporter" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'exporter')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'exporter')" :title="$t('exporterMur')"><i class="material-icons">get_app</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')"><i class="material-icons">delete</i></span>
							</div>
							<div class="actions" v-else>
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')" v-if="definirTypeMur(mur.id) === 'mur-rejoint'"><i class="material-icons">delete</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" :title="$t('quitterMur')" v-else-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">logout</i></span>
								<span class="admin" :title="$t('admin')" v-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">admin_panel_settings</i></span>
							</div>
						</div>

						<div :id="'mur-' + mur.id" class="mur mosaique" v-else :key="'mur_mosaique_' + indexMur">
							<a class="conteneur" :class="{'fond-personnalise': mur.fond.substring(1, 9) === 'fichiers'}" :style="definirFond(mur.fond)" :href="'/w/' + mur.id + '/' + mur.token + '/' + definirSlug(mur.titre)">
								<div class="meta">
									<span class="titre"><span class="mise-a-jour" v-if="mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)" />{{ mur.titre }}</span>
									<span class="date">{{ $t('creeLe') }} {{ $formaterDate(mur.date, langue) }}</span>
									<span class="auteur" v-if="mur.identifiant !== identifiant">&nbsp;{{ $t('par') }} {{ mur.identifiant }}</span>
									<span class="vues" v-if="mur.vues > 1"> - {{ mur.vues }} {{ $t('vues') }}</span>
									<span class="vues" v-else> - {{ mur.vues }} {{ $t('vue') }}</span>
								</div>
							</a>
							<div class="actions" v-if="mur.identifiant === identifiant">
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="dupliquer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'dupliquer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'dupliquer')" :title="$t('dupliquerMur')"><i class="material-icons">content_copy</i></span>
								<span class="exporter" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'exporter')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'exporter')" :title="$t('exporterMur')"><i class="material-icons">get_app</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')"><i class="material-icons">delete</i></span>
							</div>
							<div class="actions" v-else>
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')" v-if="definirTypeMur(mur.id) === 'mur-rejoint'"><i class="material-icons">delete</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" :title="$t('quitterMur')" v-else-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">logout</i></span>
								<span class="admin" :title="$t('admin')" v-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">admin_panel_settings</i></span>
							</div>
						</div>
					</template>
				</div>
				<div class="vide" v-else-if="murs.length === 0 && requete === ''">
					<span v-if="onglet === 'murs-crees'">{{ $t('aucunMurCree') }}</span>
					<span v-else-if="onglet === 'murs-rejoints'">{{ $t('aucunMurRejoint') }}</span>
					<span v-else-if="onglet === 'murs-favoris'">{{ $t('aucunFavori') }}</span>
					<span v-else>{{ $t('aucunMurDossier') }}</span>
				</div>
				<div class="murs" v-else-if="resultats.length > 0 && requete !== ''">
					<template v-for="(mur, indexMur) in resultats">
						<div :id="'mur-' + mur.id" class="mur liste" v-if="affichage === 'liste'" :key="'mur_liste_' + indexMur">
							<a class="fond" :href="'/w/' + mur.id + '/' + definirSlug(mur.titre)" :class="{'fond-personnalise': mur.fond.substring(1, 9) === 'fichiers'}" :style="definirFond(mur.fond)" />
							<a class="meta" :class="{'mur-rejoint': mur.identifiant !== identifiant, 'deplacer': dossiers.length > 0}" :href="'/w/' + mur.id + '/' + mur.token + '/' + mur.token + '/' + definirSlug(mur.titre)">
								<span class="mise-a-jour" v-if="mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)" />
								<span class="titre">{{ mur.titre }}</span>
								<span class="date">{{ $t('creeLe') }} {{ $formaterDate(mur.date, langue) }}</span>
								<span class="auteur" v-if="mur.identifiant !== identifiant">&nbsp;{{ $t('par') }} {{ mur.identifiant }}</span>
								<span class="vues" v-if="mur.vues > 1"> - {{ mur.vues }} {{ $t('vues') }}</span>
								<span class="vues" v-else> - {{ mur.vues }} {{ $t('vue') }}</span>
							</a>
							<div class="actions" v-if="mur.identifiant === identifiant">
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="dupliquer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'dupliquer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'dupliquer')" :title="$t('dupliquerMur')"><i class="material-icons">content_copy</i></span>
								<span class="exporter" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'exporter')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'exporter')" :title="$t('exporterMur')"><i class="material-icons">get_app</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')"><i class="material-icons">delete</i></span>
							</div>
							<div class="actions" v-else>
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')" v-if="definirTypeMur(mur.id) === 'mur-rejoint'"><i class="material-icons">delete</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" :title="$t('quitterMur')" v-else-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">logout</i></span>
								<span class="admin" :title="$t('admin')" v-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">admin_panel_settings</i></span>
							</div>
						</div>

						<div :id="'mur-' + mur.id" class="mur mosaique" v-else :key="'mur_mosaique_' + indexMur">
							<a class="conteneur" :class="{'fond-personnalise': mur.fond.substring(1, 9) === 'fichiers'}" :style="definirFond(mur.fond)" :href="'/w/' + mur.id + '/' + mur.token + '/' + definirSlug(mur.titre)">
								<div class="meta">
									<span class="titre"><span class="mise-a-jour" v-if="mur.hasOwnProperty('notification') && mur.notification.includes(identifiant)" />{{ mur.titre }}</span>
									<span class="date">{{ $t('creeLe') }} {{ $formaterDate(mur.date, langue) }}</span>
									<span class="auteur" v-if="mur.identifiant !== identifiant">&nbsp;{{ $t('par') }} {{ mur.identifiant }}</span>
									<span class="vues" v-if="mur.vues > 1"> - {{ mur.vues }} {{ $t('vues') }}</span>
									<span class="vues" v-else> - {{ mur.vues }} {{ $t('vue') }}</span>
								</div>
							</a>
							<div class="actions" v-if="mur.identifiant === identifiant">
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="dupliquer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'dupliquer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'dupliquer')" :title="$t('dupliquerMur')"><i class="material-icons">content_copy</i></span>
								<span class="exporter" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'exporter')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'exporter')" :title="$t('exporterMur')"><i class="material-icons">get_app</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')"><i class="material-icons">delete</i></span>
							</div>
							<div class="actions" v-else>
								<span class="ajouter-favori" role="button" :tabindex="definirTabIndex()" @click="ajouterFavori(mur)" @keydown.enter="ajouterFavori(mur)" :title="$t('ajouterFavori')" v-if="!favoris.includes(mur.id)"><i class="material-icons">star_outline</i></span>
								<span class="supprimer-favori" role="button" :tabindex="definirTabIndex()" @click="supprimerFavori(mur.id)" @keydown.enter="supprimerFavori(mur.id)" :title="$t('supprimerFavori')" v-else><i class="material-icons">star</i></span>
								<span class="deplacer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleDeplacerMur(mur.id)" @keydown.enter="afficherModaleDeplacerMur(mur.id)" :title="$t('ajouterDansDossier')" :class="{'actif': verifierDossierMur(mur.id)}" v-if="dossiers.length > 0"><i class="material-icons">drive_file_move</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer')" :title="$t('supprimerMur')" v-if="definirTypeMur(mur.id) === 'mur-rejoint'"><i class="material-icons">delete</i></span>
								<span class="supprimer" role="button" :tabindex="definirTabIndex()" @click="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" @keydown.enter="afficherModaleConfirmation($event, mur.id, 'supprimer-admin')" :title="$t('quitterMur')" v-else-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">logout</i></span>
								<span class="admin" :title="$t('admin')" v-if="definirTypeMur(mur.id) === 'mur-admin'"><i class="material-icons">admin_panel_settings</i></span>
							</div>
						</div>
					</template>
				</div>
				<div class="vide" v-else-if="resultats.length === 0 && requete !== ''">
					{{ $t('aucunResultat') }}
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-if="modale === 'mot-de-passe'">
			<div id="motdepasse" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('modifierMotDePasse') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleMotDePasse" @keydown.enter="fermerModaleMotDePasse"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<label for="champ-motdepasse-actuel">{{ $t('motDePasseActuel') }}</label>
						<input id="champ-motdepasse-actuel" type="password" maxlength="48" v-model.lazy="motDePasse">
						<label for="champ-nouveau-motdepasse">{{ $t('nouveauMotDePasse') }}</label>
						<input id="champ-nouveau-motdepasse" type="password" maxlength="48" v-model.lazy="nouveauMotDePasse">
						<label for="champ-confirmation-motdepasse">{{ $t('confirmationNouveauMotDePasse') }}</label>
						<input id="champ-confirmation-motdepasse" type="password" maxlength="48" v-model.lazy="confirmationNouveauMotDePasse" @keydown.enter="modifierMotDePasse">
						<div class="actions">
							<span class="bouton" role="button" :tabindex="definirTabIndexModale()" @click="modifierMotDePasse" @keydown.enter="modifierMotDePasse">{{ $t('modifier') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'creer-mur'">
			<div id="creation" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('creerMur') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleCreerMur" @keydown.enter="fermerModaleCreerMur"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<label for="champ-titre-mur">{{ $t('titreMur') }}</label>
						<input id="champ-titre-mur" type="text" maxlength="48" v-model.lazy="titre" @keydown.enter="creerMur">
						<div class="actions">
							<span class="bouton" role="button" :tabindex="definirTabIndexModale()" @click="creerMur" @keydown.enter="creerMur" v-if="!chargementModale">{{ $t('creer') }}</span>
							<div class="conteneur-chargement" v-else>
								<div class="chargement" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'deplacer-mur'">
			<div id="deplacement" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('ajouterDansDossier') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleDeplacerMur" @keydown.enter="fermerModaleDeplacerMur"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<label for="champ-dossier-actuel">{{ $t('dossierActuel') }}</label>
						<input id="champ-dossier-actuel" type="text" :value="$t('aucunDossier')" disabled v-if="dossierActuel.id === 'aucun'">
						<input id="champ-dossier-actuel" type="text" :value="dossierActuel.nom" disabled v-else>
						<label for="champ-dossier-mur">{{ $t('dossierDestination') }}</label>
						<select id="champ-dossier-mur">
							<option value="aucun" v-if="dossierActuel.id !== 'aucun'">{{ $t('aucunDossier') }}</option>
							<template v-for="(item, indexItem) in dossiers">
								<option :value="item.id" v-if="dossierActuel.id !== item.id" :key="'dossier_' + indexItem">{{ item.nom }}</option>
							</template>
						</select>
						<div class="actions">
							<span class="bouton" role="button" :tabindex="definirTabIndexModale()" @click="deplacerMur" @keydown.enter="deplacerMur">{{ $t('valider') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'importer-mur'">
			<div id="import" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('importerMur') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleImporterMur" @keydown.enter="fermerModaleImporterMur"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<div class="conteneur-interrupteur" v-if="progressionImport === 0">
							<span>{{ $t('importerCommentaires') }}</span>
							<label class="bouton-interrupteur" :tabindex="definirTabIndexModale()" @keydown.enter="activerInput('parametre-commentaires')">
								<input id="parametre-commentaires" type="checkbox" :checked="parametresImport.commentaires" @change="modifierParametresImport($event, 'commentaires')">
								<span class="barre" />
							</label>
						</div>
						<div class="conteneur-interrupteur" v-if="progressionImport === 0">
							<span>{{ $t('importerEvaluations') }}</span>
							<label class="bouton-interrupteur" :tabindex="definirTabIndexModale()" @keydown.enter="activerInput('parametre-evaluations')">
								<input id="parametre-evaluations" type="checkbox" :checked="parametresImport.evaluations" @change="modifierParametresImport($event, 'evaluations')">
								<span class="barre" />
							</label>
						</div>
						<div class="conteneur-interrupteur" v-if="progressionImport === 0">
							<span>{{ $t('importerActivite') }}</span>
							<label class="bouton-interrupteur" :tabindex="definirTabIndexModale()" @keydown.enter="activerInput('parametre-activite')">
								<input id="parametre-activite" type="checkbox" :checked="parametresImport.activite" @change="modifierParametresImport($event, 'activite')">
								<span class="barre" />
							</label>
						</div>
						<label for="importer-mur" class="bouton" :tabindex="definirTabIndexModale()" @keydown.enter="activerInput('importer-mur')" v-if="progressionImport === 0">{{ $t('selectionnerMur') }}</label>
						<input id="importer-mur" type="file" style="display: none" accept=".zip" @change="importerMur" v-if="progressionImport === 0">
						<div class="conteneur-chargement progression" v-if="progressionImport > 0">
							<progress class="barre-progression" max="100" :value="progressionImport" />
							<div class="chargement" />
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'ajouter-dossier'">
			<div id="ajout-dossier" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('ajouterDossier') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleAjouterDossier" @keydown.enter="fermerModaleAjouterDossier"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<label for="champ-nom-dossier">{{ $t('nomDossier') }}</label>
						<input id="champ-nom-dossier" type="text" maxlength="48" v-model.lazy="dossier" @keydown.enter="ajouterDossier">
						<div class="actions">
							<span class="bouton" role="button" :tabindex="definirTabIndexModale()" @click="ajouterDossier" @keydown.enter="ajouterDossier">{{ $t('valider') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="conteneur-modale" v-else-if="modale === 'modifier-dossier'">
			<div id="modification-dossier" class="modale" role="dialog">
				<div class="en-tete">
					<span class="titre">{{ $t('modifierDossier') }}</span>
					<span class="fermer" role="button" :tabindex="definirTabIndexModale()" @click="fermerModaleModifierDossier" @keydown.enter="fermerModaleModifierDossier"><i class="material-icons">close</i></span>
				</div>
				<div class="conteneur">
					<div class="contenu">
						<label for="champ-nom-dossier">{{ $t('nomDossier') }}</label>
						<input id="champ-nom-dossier" type="text" maxlength="48" v-model.lazy="dossier" @keydown.enter="modifierDossier">
						<div class="actions">
							<span class="bouton" role="button" :tabindex="definirTabIndexModale()" @click="modifierDossier" @keydown.enter="modifierDossier">{{ $t('valider') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div id="conteneur-message" class="conteneur-modale" v-if="modaleConfirmation !== ''">
			<div class="modale" role="dialog">
				<div class="conteneur">
					<div class="contenu">
						<div class="message" v-html="$t('confirmationDupliquerMur')" v-if="modaleConfirmation === 'dupliquer'" />
						<div class="message" v-html="$t('confirmationExporterMur')" v-else-if="modaleConfirmation === 'exporter'" />
						<div class="message" v-html="$t('confirmationSupprimerMur')" v-else-if="modaleConfirmation === 'supprimer'" />
						<div class="message" v-html="$t('confirmationSupprimerMurAdmin')" v-else-if="modaleConfirmation === 'supprimer-admin'" />
						<div class="message" v-html="$t('confirmationSupprimerCompte')" v-else-if="modaleConfirmation === 'supprimer-compte'" />
						<div class="message" v-html="$t('confirmationSupprimerDossier')" v-else-if="modaleConfirmation === 'supprimer-dossier'" />
						<div class="actions">
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="fermerModaleConfirmation" @keydown.enter="fermerModaleConfirmation">{{ $t('non') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="dupliquerMur" @keydown.enter="dupliquerMur" v-if="modaleConfirmation === 'dupliquer'">{{ $t('oui') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="exporterMur" @keydown.enter="exporterMur" v-else-if="modaleConfirmation === 'exporter'">{{ $t('oui') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="supprimerMur" @keydown.enter="supprimerMur" v-else-if="modaleConfirmation === 'supprimer'">{{ $t('oui') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="supprimerMur" @keydown.enter="supprimerMur" v-else-if="modaleConfirmation === 'supprimer-admin'">{{ $t('oui') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="supprimerCompte" @keydown.enter="supprimerCompte" v-else-if="modaleConfirmation === 'supprimer-compte'">{{ $t('oui') }}</span>
							<span class="bouton" role="button" :tabindex="message === '' ? 0 : -1" @click="supprimerDossier" @keydown.enter="supprimerDossier" v-else-if="modaleConfirmation === 'supprimer-dossier'">{{ $t('oui') }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Notification :notification="notification" @fermer="notification = ''" v-if="notification !== ''" />

		<Message :message="message" @elementPrecedent="definirElementPrecedent" @fermer="fermerMessage" v-if="message !== ''" />

		<Chargement v-if="chargement" />

		<ChargementPage v-if="chargementPage" />
	</div>
</template>

<script>
import axios from 'axios'
import imagesLoaded from 'imagesloaded'
import fileSaver from 'file-saver'
const { saveAs } = fileSaver
import v from 'voca'
import ChargementPage from '#root/components/chargement-page.vue'
import Chargement from '#root/components/chargement.vue'
import Message from '#root/components/message.vue'
import Notification from '#root/components/notification.vue'

export default {
	name: 'Utilisateur',
	components: {
		ChargementPage,
		Chargement,
		Message,
		Notification
	},
	data () {
		return {
			chargementPage: true,
			chargement: false,
			message: '',
			notification: '',
			modale: '',
			modaleConfirmation: '',
			chargementModale: false,
			menu: false,
			onglet: 'murs-crees',
			titre: '',
			progressionImport: 0,
			murId: '',
			motDePasse: '',
			nouveauMotDePasse: '',
			confirmationNouveauMotDePasse: '',
			murs: [],
			requete: '',
			resultats: [],
			favoris: [],
			parametresImport: {
				commentaires: false,
				evaluations: false,
				activite: false
			},
			dossier: '',
			dossierId: '',
			dossierActuel: {},
			elementPrecedent: null,
			hote: this.$pageContext.pageProps.hote,
			identifiant: this.$pageContext.pageProps.identifiant,
			nom: this.$pageContext.pageProps.nom,
			email: this.$pageContext.pageProps.email,
			langue: this.$pageContext.pageProps.langue,
			statut: this.$pageContext.pageProps.statut,
			affichage: this.$pageContext.pageProps.affichage,
			classement: this.$pageContext.pageProps.classement,
			limite: 100,
			mursCrees: this.$pageContext.pageProps.mursCrees,
			mursRejoints: this.$pageContext.pageProps.mursRejoints,
			mursAdmins: this.$pageContext.pageProps.mursAdmins,
			mursFavoris: this.$pageContext.pageProps.mursFavoris,
			dossiers: this.$pageContext.pageProps.dossiers
		}
	},
	watch: {
		onglet: function (onglet) {
			let murs = []
			if (onglet === 'murs-crees') {
				murs = this.mursCrees
			} else if (onglet === 'murs-rejoints') {
				murs = this.mursRejoints
			} else if (onglet === 'murs-admins') {
				murs = this.mursAdmins
			} else if (onglet === 'murs-favoris') {
				murs = this.mursFavoris
			} else {
				let listeMurs = []
				this.dossiers.forEach(function (dossier) {
					if (dossier.id === onglet) {
						listeMurs = dossier.murs
					}
				})
				const mursTous = this.mursCrees.concat(this.mursRejoints, this.mursAdmins)
				mursTous.forEach(function (mur) {
					if (listeMurs.includes(mur.id)) {
						murs.push(mur)
					}
				})
			}
			this.murs = murs
			this.requete = ''
		},
		requete: function () {
			this.rechercher()
		}
	},
	created () {
		const params = this.$pageContext.pageProps.params
		const langue = params.lang
		if (langue && this.langues.includes(langue) === true) {
			this.$i18n.locale = langue
			this.langue = langue
			this.$socket.emit('modifierlangue', langue)
		} else {
			this.$i18n.locale = this.langue
		}

		this.murs = this.mursCrees

		const favoris = []
		this.mursFavoris.forEach(function (mur) {
			favoris.push(mur.id)
		})
		this.favoris = favoris

		this.classer(this.classement)

		if (import.meta.env.VITE_WALL_LIMIT && import.meta.env.VITE_WALL_LIMIT !== '') {
			this.limite = parseInt(import.meta.env.VITE_WALL_LIMIT)
		}
	},
	mounted () {
		document.getElementsByTagName('html')[0].setAttribute('lang', this.langue)

		imagesLoaded('#murs', { background: true }, function () {
			setTimeout(function () {
				this.chargementPage = false
			}.bind(this), 300)
		}.bind(this))

		document.addEventListener('keydown', this.gererClavier, false)
	},
	beforeUnmount () {
		document.removeEventListener('keydown', this.gererClavier, false)
	},
	methods: {
		gererMenu () {
			if (!this.menu) {
				this.elementPrecedent = (document.activeElement || document.body)
				this.menu = true
				setTimeout(function () {
					document.querySelector('.menu').classList.add('ouvert')
					document.querySelector('.menu .fermer').focus()
				}, 0)
			} else {
				this.fermerMenu()
			}
		},
		fermerMenu () {
			this.menu = false
			this.gererFocus()
		},
		modifierOnglet (onglet) {
			this.onglet = onglet
		},
		activerInput (id) {
			document.querySelector('#' + id).click()
		},
		definirTabIndex () {
			return this.modale === '' && this.message === '' && this.modaleConfirmation === '' ? 0 : -1
		},
		definirTabIndexModale () {
			return this.message === '' && this.modaleConfirmation === '' ? 0 : -1
		},
		definirFond (fond) {
			if (fond.substring(0, 1) === '#') {
				return { backgroundColor: fond }
			} else {
				return { backgroundImage: 'url(' + fond + ')' }
			}
		},
		definirSlug (titre) {
			let slug = v.latinise(titre.toLowerCase())
			// eslint-disable-next-line
			slug = slug.replace(/\ /gi, '-')
			// eslint-disable-next-line
			slug = slug.replace(/[^0-9a-z_\-]/gi, '')
			return slug
		},
		afficherModaleCreerMur () {
			if (this.mursCrees.length < this.limite) {
				this.elementPrecedent = (document.activeElement || document.body)
				this.modale = 'creer-mur'
				this.$nextTick(function () {
					document.querySelector('#creation input').focus()
				})
			} else {
				this.message = this.$t('limiteMur', { limite: this.limite })
			}
		},
		creerMur () {
			if (this.titre !== '') {
				this.chargementModale = true
				axios.post(this.hote + '/api/creer-mur', {
					titre: this.titre,
					identifiant: this.identifiant
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_creation') {
						this.chargementModale = false
						this.message = this.$t('erreurCreationMur')
					} else {
						window.location.href = '/w/' + donnees.id + '/' + donnees.token + '/' + donnees.slug
					}
				}.bind(this)).catch(function () {
					this.chargementModale = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		fermerModaleCreerMur () {
			this.modale = ''
			this.titre = ''
			this.gererFocus()
		},
		afficherModaleImporterMur () {
			if (this.mursCrees.length < this.limite) {
				this.elementPrecedent = (document.activeElement || document.body)
				this.modale = 'importer-mur'
				this.$nextTick(function () {
					document.querySelector('.modale .fermer').focus()
				})
			} else {
				this.message = this.$t('limiteMur', { limite: this.limite })
			}
		},
		modifierParametresImport (event, type) {
			this.parametresImport[type] = event.target.checked
		},
		importerMur () {
			const champ = document.querySelector('#importer-mur')
			const extension = champ.files[0].name.substring(champ.files[0].name.lastIndexOf('.') + 1).toLowerCase()
			if (champ.files && champ.files[0] && extension === 'zip') {
				const formulaire = new FormData()
				formulaire.append('parametres', JSON.stringify(this.parametresImport))
				formulaire.append('fichier', champ.files[0])
				axios.post(this.hote + '/api/importer-mur', formulaire, {
					headers: {
						'Content-Type': 'multipart/form-data'
					},
					onUploadProgress: function (progression) {
						const pourcentage = parseInt(Math.round((progression.loaded * 100) / progression.total))
						this.progressionImport = pourcentage
					}.bind(this)
				}).then(function (reponse) {
					this.fermerModaleImporterMur()
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_import') {
						this.message = this.$t('erreurImportMur')
					} else if (donnees === 'donnees_corrompues') {
						this.message = this.$t('donneesCorrompuesImportMur')
					} else {
						this.onglet = 'murs-crees'
						this.mursCrees.push(donnees)
						this.notification = this.$t('murImporte')
					}
				}.bind(this)).catch(function () {
					this.fermerModaleImporterMur()
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else {
				this.message = this.$t('formatFichierPasAccepte')
				champ.value = ''
			}
		},
		fermerModaleImporterMur () {
			this.modale = ''
			this.parametresImport.commentaires = false
			this.parametresImport.evaluations = false
			this.parametresImport.activite = false
			this.progressionImport = 0
			this.gererFocus()
		},
		afficherModaleConfirmation (event, id, type) {
			event.preventDefault()
			event.stopPropagation()
			if (type === 'supprimer-compte') {
				this.fermerMenu()
			} else if (type === 'supprimer-dossier') {
				this.dossierId = id
			} else {
				this.murId = id
			}
			this.elementPrecedent = (document.activeElement || document.body)
			this.modaleConfirmation = type
			this.$nextTick(function () {
				document.querySelector('.modale .bouton').focus()
			})
		},
		fermerModaleConfirmation () {
			this.modaleConfirmation = ''
			this.murId = ''
			this.dossierId = ''
			this.gererFocus()
		},
		ajouterFavori (mur) {
			this.chargement = true
			axios.post(this.hote + '/api/ajouter-mur-favoris', {
				murId: mur.id,
				identifiant: this.identifiant
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_ajout_favori') {
					this.message = this.$t('erreurAjoutFavoris')
				} else {
					this.mursFavoris.push(mur)
					this.favoris.push(mur.id)
					this.notification = this.$t('murAjouteFavoris')
					this.$nextTick(function () {
						document.querySelector('#mur-' + mur.id + ' .supprimer-favori').focus()
					})
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		supprimerFavori (murId) {
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-mur-favoris', {
				murId: murId,
				identifiant: this.identifiant
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_suppression_favori') {
					this.message = this.$t('erreurSuppressionFavoris')
				} else {
					this.mursFavoris.forEach(function (mur, indexMur) {
						if (mur.id === murId) {
							this.mursFavoris.splice(indexMur, 1)
						}
					}.bind(this))
					this.favoris.forEach(function (favori, indexFavori) {
						if (favori === murId) {
							this.favoris.splice(indexFavori, 1)
						}
					}.bind(this))
					if (this.onglet === 'murs-favoris') {
						this.murs.forEach(function (mur, indexMur) {
							if (mur.id === murId) {
								this.murs.splice(indexMur, 1)
							}
						}.bind(this))
						this.resultats.forEach(function (mur, indexMur) {
							if (mur.id === murId) {
								this.resultats.splice(indexMur, 1)
							}
						}.bind(this))
					}
					this.notification = this.$t('murSupprimeFavoris')
					this.$nextTick(function () {
						if (document.querySelector('#mur-' + murId + ' .ajouter-favori')) {
							document.querySelector('#mur-' + murId + ' .ajouter-favori').focus()
						}
					})
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		verifierDossierMur (murId) {
			let murDansDossier = false
			this.dossiers.forEach(function (dossier) {
				if (dossier.murs.includes(murId)) {
					murDansDossier = true
				}
			})
			return murDansDossier
		},
		afficherModaleDeplacerMur (murId) {
			this.murId = murId
			let dossierActuel = { id: 'aucun', nom: '' }
			this.dossiers.forEach(function (dossier) {
				if (dossier.murs.includes(this.murId)) {
					dossierActuel = { id: dossier.id, nom: dossier.nom }
				}
			}.bind(this))
			this.dossierActuel = dossierActuel
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'deplacer-mur'
			this.$nextTick(function () {
				document.querySelector('.modale input').focus()
			})
		},
		deplacerMur () {
			const destination = document.querySelector('#champ-dossier-mur').value
			if (destination !== this.dossierActuel.id) {
				this.chargement = true
				this.modale = ''
				axios.post(this.hote + '/api/deplacer-mur', {
					murId: this.murId,
					destination: destination,
					identifiant: this.identifiant
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_deplacement') {
						this.message = this.$t('erreurDeplacementMur')
					} else if (donnees === 'non_autorise') {
						this.message = this.$t('actionNonAutorisee')
					} else {
						this.dossiers.forEach(function (dossier, indexDossier) {
							if (dossier.murs.includes(this.murId)) {
								const indexMur = dossier.murs.indexOf(this.murId)
								this.dossiers[indexDossier].murs.splice(indexMur, 1)
							}
							if (dossier.id === destination) {
								this.dossiers[indexDossier].murs.push(this.murId)
							}
						}.bind(this))
						if (this.onglet === this.dossierActuel.id) {
							this.murs.forEach(function (mur, indexMur) {
								if (mur.id === this.murId) {
									this.murs.splice(indexMur, 1)
								}
							}.bind(this))
						}
						this.notification = this.$t('murDeplace')
						this.fermerModaleDeplacerMur()
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.fermerModaleDeplacerMur()
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		fermerModaleDeplacerMur () {
			this.modale = ''
			this.murId = ''
			this.dossierActuel = {}
			this.gererFocus()
		},
		dupliquerMur () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/dupliquer-mur', {
				murId: this.murId,
				identifiant: this.identifiant
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_duplication') {
					this.message = this.$t('erreurDuplicationMur')
				} else if (donnees === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.mursCrees.push(donnees)
					this.notification = this.$t('murDuplique')
					this.murId = ''
					this.onglet = 'murs-crees'
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.murId = ''
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		exporterMur () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/exporter-mur', {
				murId: this.murId,
				identifiant: this.identifiant,
				admin: ''
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_export') {
					this.message = this.$t('erreurExportMur')
				} else if (donnees === 'non_autorise') {
					this.message = this.$t('actionNonAutorisee')
				} else {
					saveAs('/temp/' + donnees, 'mur-' + this.murId + '.zip')
				}
				this.murId = ''
			}.bind(this)).catch(function () {
				this.chargement = false
				this.murId = ''
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		supprimerMur () {
			this.modaleConfirmation = ''
			this.chargement = true
			const type = this.definirTypeMur(this.murId)
			axios.post(this.hote + '/api/supprimer-mur', {
				murId: this.murId,
				type: type,
				identifiant: this.identifiant,
				admin: ''
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'non_autorise') {
					window.location.replace('/')
				} else if (donnees === 'erreur_suppression') {
					this.message = this.$t('erreurSuppressionMur')
				} else {
					this.mursCrees.forEach(function (mur, index) {
						if (mur.id === this.murId) {
							this.mursCrees.splice(index, 1)
						}
					}.bind(this))
					this.mursRejoints.forEach(function (mur, index) {
						if (mur.id === this.murId) {
							this.mursRejoints.splice(index, 1)
						}
					}.bind(this))
					this.mursAdmins.forEach(function (mur, index) {
						if (mur.id === this.murId) {
							this.mursAdmins.splice(index, 1)
						}
					}.bind(this))
					this.mursFavoris.forEach(function (mur, index) {
						if (mur.id === this.murId) {
							this.mursFavoris.splice(index, 1)
						}
					}.bind(this))
					this.favoris.forEach(function (favori, index) {
						if (favori === this.murId) {
							this.favoris.splice(index, 1)
						}
					}.bind(this))
					this.murs.forEach(function (mur, index) {
						if (mur.id === this.murId) {
							this.murs.splice(index, 1)
						}
					}.bind(this))
					this.resultats.forEach(function (pad, index) {
						if (pad.id === this.padId) {
							this.resultats.splice(index, 1)
						}
					}.bind(this))
					this.dossiers.forEach(function (dossier, indexDossier) {
						if (dossier.murs.includes(this.murId)) {
							const indexMur = dossier.murs.indexOf(this.murId)
							this.dossiers[indexDossier].murs.splice(indexMur, 1)
						}
					}.bind(this))
					this.notification = this.$t('murSupprime')
					this.murId = ''
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.murId = ''
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		definirTypeMur (murId) {
			let type = ''
			this.mursRejoints.forEach(function (mur) {
				if (mur.id === murId) {
					type = 'mur-rejoint'
				}
			})
			this.mursAdmins.forEach(function (mur) {
				if (mur.id === murId) {
					type = 'mur-admin'
				}
			})
			return type
		},
		rechercher () {
			let resultats = []
			if (this.requete === '!maj') {
				resultats = this.murs.filter(function (element) {
					return element.notification && element.notification.includes(this.identifiant)
				}.bind(this))
			} else {
				resultats = this.murs.filter(function (element) {
					return element.titre.toLowerCase().includes(this.requete.toLowerCase())
				}.bind(this))
			}
			this.resultats = resultats
		},
		classer (classement) {
			let murs = this.murs
			if (this.requete !== '') {
				murs = this.resultats
			}
			switch (classement) {
			case 'date-asc':
				murs.sort(function (a, b) {
					const dateA = new Date(a.date).getTime()
					const dateB = new Date(b.date).getTime()
					return dateA > dateB ? 1 : -1
				})
				break
			case 'date-desc':
				murs.sort(function (a, b) {
					const dateA = new Date(a.date).getTime()
					const dateB = new Date(b.date).getTime()
					return dateA < dateB ? 1 : -1
				})
				break
			case 'alpha-asc':
				murs.sort(function (a, b) {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 < b1 ? -1 : a1 > b1 ? 1 : 0
				})
				break
			case 'alpha-desc':
				murs.sort(function (a, b) {
					const a1 = a.titre.toLowerCase()
					const b1 = b.titre.toLowerCase()
					return a1 > b1 ? -1 : a1 < b1 ? 1 : 0
				})
				break
			}
			if (this.requete === '') {
				this.murs = murs
			} else {
				this.resultats = murs
			}
		},
		modifierClassement (classement) {
			if (this.classement !== classement) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-classement', {
					identifiant: this.identifiant,
					classement: classement
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else {
						this.classer(classement)
						this.classement = classement
						this.notification = this.$t('classementModifie')
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		modifierInformations () {
			const nom = document.querySelector('#nom').value.trim()
			const email = document.querySelector('#email').value.trim()
			if ((nom !== '' && nom !== this.nom) || (email !== '' && email !== this.email)) {
				if (email !== '' && this.$verifierEmail(email) === false) {
					this.message = this.$t('erreurEmail')
					return false
				}
				this.menu = false
				this.chargement = true
				axios.post(this.hote + '/api/modifier-informations', {
					identifiant: this.identifiant,
					nom: nom,
					email: email
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else {
						this.nom = nom
						this.email = email
						this.notification = this.$t('informationsModifiees')
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		afficherModaleMotDePasse () {
			this.menu = false
			this.modale = 'mot-de-passe'
			this.$nextTick(function () {
				document.querySelector('#champ-motdepasse-actuel').focus()
			})
		},
		modifierMotDePasse () {
			const motDePasse = this.motDePasse
			const nouveauMotDePasse = this.nouveauMotDePasse.trim()
			const confirmationNouveauMotDePasse = this.confirmationNouveauMotDePasse.trim()
			if (nouveauMotDePasse === confirmationNouveauMotDePasse && nouveauMotDePasse !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/modifier-mot-de-passe', {
					identifiant: this.identifiant,
					motdepasse: motDePasse,
					nouveaumotdepasse: nouveauMotDePasse
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'motdepasse_incorrect') {
						this.message = this.$t('motDePasseActuelPasCorrect')
					} else if (donnees === 'erreur') {
						this.message = this.$t('erreurCommunicationServeur')
					} else {
						this.notification = this.$t('motDePasseModifie')
					}
					this.fermerModaleMotDePasse()
				}.bind(this)).catch(function () {
					this.chargement = false
					this.fermerModaleMotDePasse()
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			} else if (nouveauMotDePasse !== confirmationNouveauMotDePasse) {
				this.message = this.$t('nouveauxMotsDePasseCorrespondentPas')
			}
		},
		fermerModaleMotDePasse () {
			this.modale = ''
			this.motDePasse = ''
			this.nouveauMotDePasse = ''
			this.confirmationNouveauMotDePasse = ''
			this.gererFocus()
		},
		modifierLangue (langue) {
			if (this.langue !== langue) {
				axios.post(this.hote + '/api/modifier-langue', {
					identifiant: this.identifiant,
					langue: langue
				}).then(function (reponse) {
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else {
						this.$i18n.locale = langue
						document.getElementsByTagName('html')[0].setAttribute('lang', langue)
						this.langue = langue
						this.notification = this.$t('langueModifiee')
					}
				}.bind(this)).catch(function () {
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		modifierAffichage (affichage) {
			if (this.affichage !== affichage) {
				this.chargement = true
				axios.post(this.hote + '/api/modifier-affichage', {
					identifiant: this.identifiant,
					affichage: affichage
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else {
						this.affichage = affichage
						this.notification = this.$t('affichageModifie')
					}
				}.bind(this)).catch(function () {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		afficherModaleAjouterDossier () {
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'ajouter-dossier'
			this.$nextTick(function () {
				document.querySelector('#ajout-dossier input').focus()
			})
		},
		ajouterDossier () {
			if (this.dossier !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/ajouter-dossier', {
					dossier: this.dossier,
					identifiant: this.identifiant
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_ajout_dossier') {
						this.message = this.$t('erreurAjoutDossier')
					} else {
						this.dossiers.push(donnees)
						this.notification = this.$t('dossierAjoute')
					}
					this.dossier = ''
				}.bind(this)).catch(function () {
					this.chargement = false
					this.dossier = ''
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		fermerModaleAjouterDossier () {
			this.modale = ''
			this.dossier = ''
			this.gererFocus()
		},
		afficherModaleModifierDossier (event, id) {
			event.preventDefault()
			event.stopPropagation()
			this.dossiers.forEach(function (dossier) {
				if (dossier.id === id) {
					this.dossier = dossier.nom
				}
			}.bind(this))
			this.dossierId = id
			this.elementPrecedent = (document.activeElement || document.body)
			this.modale = 'modifier-dossier'
			this.$nextTick(function () {
				document.querySelector('#modification-dossier input').focus()
			})
		},
		modifierDossier () {
			if (this.dossier !== '') {
				this.modale = ''
				this.chargement = true
				axios.post(this.hote + '/api/modifier-dossier', {
					dossier: this.dossier,
					dossierId: this.dossierId,
					identifiant: this.identifiant
				}).then(function (reponse) {
					this.chargement = false
					const donnees = reponse.data
					if (donnees === 'non_connecte') {
						window.location.replace('/')
					} else if (donnees === 'erreur_modification_dossier') {
						this.message = this.$t('erreurModificationDossier')
					} else {
						this.dossiers.forEach(function (dossier, index) {
							if (dossier.id === this.dossierId) {
								this.dossiers[index].nom = this.dossier
							}
						}.bind(this))
						this.notification = this.$t('dossierModifie')
					}
					this.fermerModaleModifierDossier()
				}.bind(this)).catch(function () {
					this.chargement = false
					this.fermerModaleModifierDossier()
					this.message = this.$t('erreurCommunicationServeur')
				}.bind(this))
			}
		},
		fermerModaleModifierDossier () {
			this.modale = ''
			this.dossier = ''
			this.dossierId = ''
			this.gererFocus()
		},
		supprimerDossier () {
			this.modaleConfirmation = ''
			this.chargement = true
			axios.post(this.hote + '/api/supprimer-dossier', {
				dossierId: this.dossierId,
				identifiant: this.identifiant
			}).then(function (reponse) {
				this.chargement = false
				const donnees = reponse.data
				if (donnees === 'non_connecte') {
					window.location.replace('/')
				} else if (donnees === 'erreur_suppression_dossier') {
					this.message = this.$t('erreurSuppressionDossier')
				} else {
					this.dossiers.forEach(function (dossier, index) {
						if (dossier.id === this.dossierId) {
							this.dossiers.splice(index, 1)
						}
					}.bind(this))
					this.onglet = 'murs-crees'
					this.notification = this.$t('dossierSupprime')
					this.dossierId = ''
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.dossierId = ''
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		supprimerCompte () {
			this.chargement = true
			this.modaleConfirmation = ''
			const identifiant = this.identifiant
			axios.post(this.hote + '/api/supprimer-compte', {
				identifiant: identifiant,
				admin: ''
			}).then(function (reponse) {
				const donnees = reponse.data
				if (donnees === 'erreur') {
					this.chargement = false
					this.message = this.$t('erreurCommunicationServeur')
				} else if (donnees === 'non_autorise') {
					this.chargement = false
					this.message = this.$t('actionNonAutorisee')
				} else {
					this.$socket.emit('deconnexion', identifiant)
					window.location.replace('/')
				}
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		deconnexion () {
			this.chargement = true
			const identifiant = this.identifiant
			axios.post(this.hote + '/api/deconnexion').then(function () {
				this.$socket.emit('deconnexion', identifiant)
				window.location.replace('/')
			}.bind(this)).catch(function () {
				this.chargement = false
				this.message = this.$t('erreurCommunicationServeur')
			}.bind(this))
		},
		fermerModale () {
			this.modale = ''
			this.gererFocus()
		},
		fermerMessage () {
			this.message = ''
			this.gererFocus()
		},
		definirElementPrecedent (element) {
			this.elementPrecedent = element
		},
		gererFocus () {
			if (this.elementPrecedent) {
				this.elementPrecedent.focus()
				this.elementPrecedent = null
			}
		},
		gererClavier (event) {
			if (event.key === 'Escape' && this.message !== '') {
				this.fermerMessage()
			} else if (event.key === 'Escape' && this.modaleConfirmation !== '') {
				this.fermerModaleConfirmation()
			} else if (event.key === 'Escape' && this.modale !== '') {
				this.fermerModale()
			} else if (event.key === 'Escape' && this.menu) {
				this.fermerMenu()
			}
		}
	}
}
</script>

<style scoped>
#page {
	width: 100%;
	height: 100%;
}

#boutons {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	margin-bottom: 1.5rem;
}

#bouton-importer,
#bouton-creer {
	display: inline-flex;
	justify-content: center;
	align-items: center;
	width: 220px;
    line-height: 1;
    font-size: 1.6rem;
    font-weight: 700;
    text-transform: uppercase;
	padding: 0.75em 1em;
    border: 2px solid #00ced1;
	border-radius: 2em;
	margin-bottom: 1.5rem;
	background: #46fbff;
	cursor: pointer;
    transition: all 0.1s ease-in;
	text-align: center;
}

#bouton-importer.desactive,
#bouton-creer.desactive {
	border: 2px solid #777;
	background: #aaa;
	cursor: default;
}

#bouton-creer {
	margin-right: 1.5rem;
}

#bouton-importer:not(.desactive):hover,
#bouton-creer:not(.desactive):hover {
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.2);
	background: #fff;
}

#identifiant {
	background: #e9e9e9;
}

#deconnexion {
	color: #ff6259;
	margin-bottom: 3rem;
}

.menu .bouton-rouge,
.menu .bouton-bleu {
	margin-top: 3rem;
}

.menu .bouton-rouge {
	margin-bottom: 3rem;
}

#onglets {
	position: absolute;
    top: 4rem;
	left: 4rem;
    height: calc(100% - 4rem);
	width: 30rem;
	padding: 3rem 1.5rem;
	border-right: 1px solid #ddd;
	overflow: auto;
	-webkit-overflow-scrolling: touch;
}

#onglets .onglet {
	position: relative;
	display: block;
	text-align: left;
	padding-bottom: 0.5rem;
	margin-bottom: 2rem;
	font-size: 1.8rem;
	border-bottom: 3px solid transparent;
	cursor: pointer;
}

#onglets .onglet.actif {
	font-weight: 700;
	border-bottom: 3px solid #00ced1;
}

#onglets .bouton-ajouter {
	display: inline-block;
	font-weight: 700;
	font-size: 12px;
	text-transform: uppercase;
	height: 32px;
	line-height: 32px;
	padding: 0 20px;
	cursor: pointer;
	color: #001d1d;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.1);
	background: #00ced1;
	border-radius: 5px;
	letter-spacing: 1px;
	text-indent: 1px;
	text-align: center;
	transition: all 0.1s ease-in;
	white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
	margin-bottom: 3rem;
}

#onglets .bouton-ajouter:hover {
	color: #fff;
	background: #001d1d;
}

#onglets .onglet .menu-dossier {
	visibility: hidden;
	position: absolute;
	color: #fff;
	top: 0;
	right: 0;
	line-height: 1;
	font-size: 24px;
	padding: 3px 1rem;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 4px;
	opacity: 0;
	transition: opacity 0.25s ease-in-out;
}

#onglets .onglet:hover .menu-dossier {
	visibility: visible;
	opacity: 1;
}

#onglets .onglet .menu-dossier span.supprimer {
	color: #ff6259;
	cursor: pointer;
}

#onglets .onglet .menu-dossier span + span {
	margin-left: 0.7rem;
}

#onglets .onglet > span {
	margin-right: 0.7rem;
	vertical-align: middle;
}

#onglets .onglet .badge {
	display: inline-block;
	width: 2rem;
	height: 2rem;
	background: #e32f6c;
	margin-right: 0;
	border-radius: 50%;
	font-size: 1.2rem;
	color: #fff;
	line-height: 2rem;
	text-align: center;
	vertical-align: middle;
}

#murs {
	position: absolute;
    top: 4rem;
	left: 34rem;
	padding: 3rem 1.5rem;
	height: calc(100% - 4rem);
	width: calc(100% - 34rem);
	overflow: auto;
	-webkit-overflow-scrolling: touch;
}

#murs.liste {
	padding: 3rem 1.5rem;
}

#murs.mosaique {
	padding: 3rem 0.75rem;
}

.vide {
	text-align: center;
	font-size: 1.7rem;
    padding: 2.5rem 0;
    border-top: 1px dotted #ddd;
    border-bottom: 1px dotted #ddd;
    margin: 0 0 3rem;
}

#afficher {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	margin-bottom: 3rem;
	width: 100%;
	font-size: 0;
}

.mosaique #actions-dossier,
.mosaique #afficher {
	padding: 0 0.75rem;
}

#afficher .rechercher,
#afficher .classer {
	display: flex;
	align-items: center;
	width: calc(50% - (24px + 2.5rem));
}

#afficher .classer,
#afficher .rechercher {
	margin-right: 2rem;
}

#afficher .afficher span,
#afficher .classer span,
#afficher .rechercher span {
	font-size: 24px;
	margin-right: 1rem;
}

#afficher .classer select,
#afficher .rechercher input {
	width: calc(100% - (24px + 1rem));
}

#afficher select,
#afficher input[type="search"] {
	font-size: 16px;
	border: 1px solid #ddd;
	border-radius: 4px;
	padding: 1rem 1.5rem;
	text-align: left;
}

#afficher select {
	background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="14" viewBox="0 0 29 14" width="29"><path fill="%23000000" d="M9.37727 3.625l5.08154 6.93523L19.54036 3.625" /></svg>') center right no-repeat;
	padding-right: 3rem;
}

#afficher .afficher span {
	cursor: pointer;
}

#afficher .afficher span:last-child {
	margin-right: 0;
}

#actions-dossier {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	font-size: 16px;
	margin-bottom: 3rem;
}

#actions-dossier .conteneur {
	display: flex;
	justify-content: flex-start;
	align-items: center;
	padding: 3px 1rem;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 4px;
}

#actions-dossier span {
	color: #fff;
	font-size: 24px;
	margin-left: 1.5rem;
	cursor: pointer;
}

#actions-dossier span.supprimer {
	color: #ff6259;
	cursor: pointer;
}

.murs {
	margin-bottom: 3rem;
}

.mosaique .murs {
	display: flex;
	flex-wrap: wrap;
}

.mur.liste {
	border-top: 1px solid #ddd;
	padding: 2rem 0;
	display: flex;
	align-items: center;
}

.mur.liste:last-child {
	border-bottom: 1px solid #ddd;
}

.mur.liste .fond {
	width: 5rem;
	height: 5rem;
	line-height: 5rem;
	border-radius: 50%;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	margin-right: 2rem;
}

.mur.liste .meta {
	width: calc(100% - (96px + 13.5rem));
}

.mur.liste .meta.mur-rejoint {
	width: calc(100% - (48px + 10.5rem));
}

.mur.liste .meta.deplacer {
	width: calc(100% - (120px + 15rem));
}

.mur.liste .meta.mur-rejoint.deplacer {
	width: calc(100% - (72px + 12rem));
}

.mur.liste .titre {
	font-size: 1.8rem;
	font-weight: 700;
	margin-right: 0.7rem;
}

.mur.liste .vues,
.mur.liste .auteur,
.mur.liste .date {
	font-size: 1.2rem;
	color: #777;
}

.mur.liste .actions {
	display: flex;
	margin-left: 0.5rem;
}

.mur.liste .actions span {
	margin-left: 1.5rem;
	font-size: 24px;
	color: #001d1d;
	cursor: pointer;
}

.mur.mosaique .actions span.supprimer-favori,
.mur.liste .actions span.supprimer-favori {
	color: #fdcc33;
}

.mur.mosaique .actions span.deplacer.actif,
.mur.liste .actions span.deplacer.actif {
	color: #e32f6c;
}

.mur.mosaique {
    padding: 0 0 4rem;
	width: calc(50% - 1.5rem);
	height: 20rem;
    border: 2px solid #001d1d;
    margin: 0 0.75rem 1.5rem;
	position: relative;
	border-radius: 1rem;
}

.mur.mosaique .conteneur {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 0;
	width: 100%;
	height: 100%;
	cursor: pointer;
	border-top-left-radius: 1rem;
	border-top-right-radius: 1rem;
}

.mur.mosaique .conteneur.fond-personnalise {
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
}

.mur.mosaique .meta {
	width: 100%;
	padding: 1.5rem;
    background: rgba(0, 0, 0, 0.7);
	text-align: center;
}

.mur.mosaique .titre {
	display: block;
	color: #fff;
	text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
    font-size: 2rem;
	line-height: 1.4;
	font-weight: 700;
}

.mur.mosaique .vues,
.mur.mosaique .auteur,
.mur.mosaique .date {
    margin-top: 0.5rem;
    color: #ddd;
    font-size: 1.2rem;
    display: inline-block;
}

.mur.mosaique .vues {
	margin-left: 0.35rem;
}

.mur.mosaique .actions {
	position: absolute;
	display: flex;
	justify-content: space-evenly;
	align-items: center;
	height: 4rem;
	left: 0;
	right: 0;
	bottom: 0;
	width: 100%;
    font-size: 24px;
	border-top: 1px dashed #ddd;
	line-height: 1;
}

.mur.mosaique .actions span {
	color: #001d1d;
	cursor: pointer;
	text-align: center;
	display: inline-block;
}

.mur.liste .actions .supprimer,
.mur.mosaique .actions .supprimer {
	color: #ff6259;
}

.mur.liste .actions .admin,
.mur.mosaique .actions .admin {
	color: #00ced1;
}

.mur .mise-a-jour {
	width: 1rem;
	height: 1rem;
	display: inline-block;
	border-radius: 50%;
	background: #e32f6c;
	margin-right: 0.7rem;
}

.mur.mosaique .mise-a-jour {
	margin-right: 5px;
}

#import label:not(.bouton-interrupteur) {
	width: 100%;
	text-align: center;
	margin-top: 10px;
}

#import .contenu {
	font-size: 0;
}

.progression .chargement {
	border-top: 0.7rem solid #00ced1;
	margin-top: 1rem;
}

.modale .conteneur-interrupteur {
	display: flex;
	justify-content: space-between;
	margin-bottom: 1rem;
	line-height: 2.2rem;
}

.modale .conteneur-interrupteur > span {
	font-size: 16px;
}

.modale .bouton-interrupteur {
	position: relative;
	display: inline-block!important;
	width: 3.8rem!important;
	height: 2.2rem;
	margin: 0;
}

.modale .bouton-interrupteur input {
	opacity: 0;
	width: 0;
	height: 0;
}

.modale .bouton-interrupteur .barre {
	position: absolute;
	cursor: pointer;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: #ccc;
	transition: 0.2s;
	border-radius: 3rem;
}

.modale .bouton-interrupteur .barre:before {
	position: absolute;
	content: '';
	height: 1.6rem;
	width: 1.6rem;
	left: 0.3rem;
	bottom: 0.3rem;
	background-color: #fff;
	transition: 0.2s;
	border-radius: 50%;
}

.modale .bouton-interrupteur input:checked + .barre {
	background-color: #00ced1;
}

.modale .bouton-interrupteur input:focus + .barre {
	box-shadow: 0 0 1px #00ced1;
}

.modale .bouton-interrupteur input:checked + .barre:before {
	transform: translateX(1.6rem);
}

@media screen and (max-width: 479px) {
	#afficher {
		flex-wrap: wrap;
	}

	#afficher .rechercher {
		width: 100%;
		margin-right: 0;
		margin-bottom: 1.5rem;
	}

	#afficher .classer {
		width: 100%;
		margin-right: 0;
		margin-bottom: 1.5rem;
	}

	#afficher .afficher {
		line-height: 1;
	}
}

@media screen and (orientation: landscape) and (max-height: 479px) {
	#motdepasse {
		height: 90%;
	}
}

@media screen and (max-width: 479px) {
	#bouton-creer {
		margin-right: 0;
	}
}

@media screen and (max-width: 575px) {
	#onglets .onglet {
		font-size: 16px;
	}

	#murs .vide {
		font-size: 16px;
	}

	.mur.liste .titre {
		font-size: 16px;
	}

	.mur.mosaique .titre {
		font-size: 1.7rem;
	}
}

@media screen and (max-width: 599px) {
	.mur.liste {
		flex-wrap: wrap;
		padding: 2rem 0 1rem;
	}

	.mur.liste .fond {
		width: 35px;
		height: 35px;
		line-height: 35px;
		margin-right: 15px;
	}

	.mur.liste .meta {
		width: calc(100% - 50px)!important;
	}

	.mur.liste .actions {
		width: 100%;
		justify-content: space-around;
		margin-left: 0;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px dotted #ddd;
	}

	.mur.liste .actions span {
		margin-left: 0;
	}
}

@media screen and (max-width: 1023px) {
	#onglets {
		position: absolute;
		top: 4rem;
		left: 4rem;
		height: 5rem;
		width: calc(100% - 4rem);
		display: flex;
		align-items: center;
		padding: 0 1.5rem;
		border-bottom: 1px solid #ddd;
	}

	#onglets .onglet {
		text-align: left;
		padding-bottom: 0;
		margin-right: 2rem;
		margin-bottom: 0;
		border-bottom: 3px solid transparent;
		flex: 0 0 auto;
	}

	#onglets .onglet:hover .menu-dossier,
	#onglets .onglet .menu-dossier {
		display: none;
	}

	#onglets .bouton-ajouter {
		min-width: 200px;
		max-width: 250px;
		margin-bottom: 0!important;
	}

	#murs {
		position: absolute;
		top: 9rem;
		left: 4rem;
		padding: 3rem 1.5rem;
		height: calc(100% - 9rem);
		width: calc(100% - 4rem);
	}
}

@media screen and (min-width: 1024px) and (max-width: 1439px) {
	#onglets {
		width: 23rem;
	}

	#murs {
		left: 27rem;
		width: calc(100% - 27rem);
	}
}

@media screen and (max-width: 767px) {
	.mur.mosaique {
		width: calc(100% - 1.5rem);
	}
}

@media screen and (min-width: 768px) and (max-width: 1439px) {
	.mur.mosaique {
		width: calc(50% - 1.5rem);
	}
}

@media screen and (min-width: 1440px) {
	.mur.mosaique {
		width: calc(33.333333333% - 1.5rem);
	}
}
</style>
