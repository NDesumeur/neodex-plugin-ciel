# Ciel ce soir

Ce qu’il y a à voir dans le ciel cette nuit, depuis ta ville.

*English version: [README.en.md](README.en.md)*

## Alertes de l'ISS (nouveau en 1.2.0)

Coche ME PRÉVENIR dans la carte des passages : une notification arrive avant chaque passage de la station spatiale (5 à 30 min avant, tous ou seulement les beaux), même Ciel fermé.

## Ce qu’il montre

- **Cette nuit** : l’heure du coucher et du lever du soleil, puis chaque planète visible (Mercure, Vénus, Mars, Jupiter, Saturne) et la Lune : de quelle heure à quelle heure, quand elle est au plus haut, à quelle hauteur et dans quelle direction.
- **Le ciel comme dehors** : un panorama vers une direction, avec l’horizon, des collines, des sapins et une maison. Fais glisser la vue (ou ◀ ▶ et les flèches) pour tourner et lever les yeux, et le curseur d’heure pour avancer dans la nuit. Plus de 4 000 étoiles avec leurs vraies couleurs, qui scintillent près de l’horizon, la Voie lactée, les 88 constellations, la Lune et sa phase, le ciel qui rougit au coucher du soleil.
- **Les passages de l’ISS** des trois prochaines nuits : quand elle apparaît, jusqu’où elle monte, où elle disparaît. Seuls les passages vraiment visibles sont gardés (toi dans la nuit, elle au soleil).

## Ta ville

Le bouton **Ville** : tape le nom de ta ville, elle est retenue. Au départ, c’est Paris.

## Précision

Positions calculées sur ton PC avec les formules de Paul Schlyter (au degré près). L’ISS est calculée à partir de son orbite publiée par **CelesTrak** : horaires à quelques minutes près. Hors ligne, la dernière orbite connue sert encore quelques jours.

## Données

Les étoiles et le tracé des constellations viennent de **d3-celestial** d’Olaf Frohn (licence BSD, voir [LICENCE-DONNEES.md](LICENCE-DONNEES.md)), d’après le Yale Bright Star Catalogue. La Voie lactée est calculée d’après le plan de la Galaxie.

## Autorisations

- **Données** : ta ville et la dernière orbite de l’ISS. **celestrak.org** : télécharger cette orbite. **geocoding-api.open-meteo.com** : trouver ta ville sur la carte. **Notifications** et **tâches de fond** : les alertes de passage de l’ISS, même Ciel fermé.

## Installer

Dans NeoDex : **NeoStore → À découvrir → Ciel ce soir → Installer**.

## La fiche (1.1.0)

Un clic sur une planète, la Lune, l’ISS, une étoile brillante ou une constellation (26 ont une fiche) ouvre sa fiche : ce que c’est, ce qu’on y voit, et où elle est à l’heure choisie. L’objet est encadré dans la vue.

La colonne « Cette nuit » met en premier le plus beau à voir (la Lune, une planète brillante, un beau passage de l’ISS), avec une ligne courte par astre. Un clic sur une ligne avance l’heure et tourne la vue vers l’astre.

## Alertes de passage de l’ISS (1.2.0)

La station spatiale est le spectacle le plus facile à voir : un point très brillant qui traverse le ciel en quelques minutes, sans clignoter. Dans la carte **PASSAGES DE L’ISS** :

- coche **ME PRÉVENIR** : une notification arrive **5, 10, 15 ou 30 min avant** chaque passage, avec l’heure, la direction où elle apparaît, celle où elle file, et sa hauteur ;
- choisis **tous les passages**, **les beaux** (plus de 30° de hauteur) ou **les très beaux** (plus de 50°) ;
- **ESSAYER** envoie tout de suite une notification d’essai.

L’alerte marche même Ciel fermé, tant que NeoDex est ouvert (autorisation **tâches de fond**). Un passage ne prévient qu’une fois, et pas si le PC se réveille après son début. L’orbite est relue deux fois par jour au plus chez CelesTrak ; les passages marqués « alerte » dans la liste sont ceux qui préviendront.
