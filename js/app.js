document.addEventListener("DOMContentLoaded", () => {
    // === 1. Authentification Spotify ===
    const clientId = 'fed9df2931a94c948d4a992b13f5567f';
    const redirectUri = 'http://localhost:5500/'; // Pour le travail en local
    const scopes = 'user-read-private user-read-email'; // Ajout des scopes nécessaires

    function authenticate() {
        const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
        window.location.href = authUrl;
    }

    function getAccessTokenFromUrl() {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get('access_token');
    
        if (token) {
            // Nettoie l'URL après extraction du token
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        return token;
    }
    
    const token = getAccessTokenFromUrl();
    console.log('Token utilisé :', token);
    
    if (!token) {
        authenticate();
        return;
    }
    

    const form = document.getElementById("search-form");
    const artistInfo = document.getElementById("artist-info");
    const artistTemplate = document.getElementById("artist-template");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const artistName = document.getElementById("artist-name").value;
        artistInfo.innerHTML = "";

        try {
            const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error("Erreur lors de la recherche de l'artiste");

            const data = await response.json();
            data.artists.items.forEach(displayArtist);
        } catch (error) {
            console.error(error);
            artistInfo.innerHTML = "<p>Impossible de récupérer les données. Vérifiez votre connexion ou le token Spotify.</p>";
        }
    });

    // ✅ Fonction pour formater le nombre de followers
    function formatFollowers(number) {
        if (number >= 1_000_000) {
            return (number / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
        } else if (number >= 1_000) {
            return (number / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return number;
    }

    // 🔑 Fonction d'affichage des artistes
    function displayArtist(artist) {
        const clone = artistTemplate.content.cloneNode(true);

        // ✅ Déclaration de coverImage avec gestion CORS
        const coverImage = clone.querySelector(".artist-cover");
        coverImage.crossOrigin = "anonymous";  // 👉 Ajout de l'attribut crossOrigin
        coverImage.src = artist.images[0] ? artist.images[0].url : './assets/images/default.jpg';

        clone.querySelector(".artist-name").textContent = artist.name;
        clone.querySelector(".artist-name").href = artist.external_urls.spotify;
        clone.querySelector(".artist-followers").textContent = `Followers: ${formatFollowers(artist.followers.total)}`;
        // clone.querySelector(".artist-popularity").innerHTML = renderStars(artist.popularity);

        const genresContainer = clone.querySelector(".artist-genres");
        artist.genres.forEach(genre => {
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent = genre;
            genresContainer.appendChild(tag);
        });

        const tracksContainer = clone.querySelector('.artist-tracks');

        // ✅ Sélection de la carte artiste pour appliquer les couleurs
        const artistCard = clone.querySelector('.artist-card'); // S'assurer que la carte est ciblée

        // 🎨 Appliquer la couleur dominante après chargement de l'image
        coverImage.addEventListener('load', () => {
            const colorThief = new ColorThief();
            try {
                const dominantColor = colorThief.getColor(coverImage);

                // ✅ Appliquer la couleur de fond à la carte de l'artiste
                if (artistCard) {
                    artistCard.style.backgroundColor = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;

                    // ✅ Ajustement de la couleur du texte en fonction de la luminosité du fond
                    adjustTextColor(artistCard, dominantColor);
                }
            } catch (error) {
                console.error('Erreur lors de la récupération de la couleur dominante:', error);
            }
        });

        artistInfo.appendChild(clone);
        fetchTopTracks(artist.id, tracksContainer);
    }

    // Fonction pour ajuster la couleur du texte en fonction de la luminosité du fond
    function adjustTextColor(card, dominantColor) {
        // Convertir RGB en HSL
        const [r, g, b] = dominantColor;
        const [h, s, l] = rgbToHsl(r, g, b);  // Utilisation de HSL

        // Ajustement de la luminosité pour le texte
        if (l < 50) {  // Si fond sombre
            // Texte clair mais plus clair (luminosité augmentée à 90%)
            card.style.color = `hsl(${h}, ${s}%, 90%)`;  // Éclaircir le texte sur fond sombre
        } else {  // Si fond clair
            // Texte plus foncé (luminosité ajustée entre 15-20%)
            card.style.color = `hsl(${h}, ${s}%, 20%)`;  // Assombrir le texte sur fond clair
        }
    }

        // Fonction pour convertir RGB en HSL
        function rgbToHsl(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            let max = Math.max(r, g, b);
            let min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
    
            if (max === min) {
                h = s = 0; // achromatic
            } else {
                let d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                if (max === r) {
                    h = (g - b) / d + (g < b ? 6 : 0);
                } else if (max === g) {
                    h = (b - r) / d + 2;
                } else {
                    h = (r - g) / d + 4;
                }
                h /= 6;
            }
    
            return [h * 360, s * 100, l * 100]; // Retourne HSL
        }

    /* function renderStars(popularity) {
        const stars = Math.round((popularity / 100) * 5);
        return '⭐'.repeat(stars);
    } */

    async function fetchTopTracks(artistId, container) {
        try {
            const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=FR`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            console.log("Données des top tracks:", data);
    
            // Sélection correcte de la div artist-tracks
            let tracksContainer = container.querySelector('.artist-tracks');
      
            // Si elle n'existe pas, on la crée
            if (!tracksContainer) {
                tracksContainer = document.createElement('div');
                tracksContainer.classList.add('artist-tracks');
                container.appendChild(tracksContainer);
            }
    
            // Nettoyage avant d'ajouter de nouveaux morceaux
            tracksContainer.innerHTML = '';
            
            // Vérifie si des pistes sont disponibles
            if (data.tracks && data.tracks.length > 0) {
                data.tracks.slice(0, 3).forEach(track => {
                    const trackLink = document.createElement('a');
                    trackLink.href = track.external_urls.spotify;
                    trackLink.textContent = track.name;
                    trackLink.target = "_blank";
                    trackLink.classList.add('track-link');
                    console.log("Titre :", track.name);  // Vérifie si les titres sont bien lus
                    tracksContainer.appendChild(trackLink);
                });
            } else {
                tracksContainer.textContent = 'Aucun titre trouvé';
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des morceaux :', error);
        }
    }
});
