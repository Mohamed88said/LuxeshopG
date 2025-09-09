// Définition locale de getCookie
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

document.addEventListener('DOMContentLoaded', function() {
    const productCarousel = new bootstrap.Carousel('#productCarousel-{{ product.id }}', { interval: 3000, pause: 'hover', wrap: true });
    const recommendedCarousel = document.getElementById('recommendedCarousel');
    if (recommendedCarousel) {
        new bootstrap.Carousel(recommendedCarousel, { interval: 5000, wrap: true });
    }

    function switchImage(index, productId) {
        const carousel = new bootstrap.Carousel(`#productCarousel-${productId}`);
        carousel.to(index);
        document.querySelectorAll(`#productCarousel-${productId} .thumbnail`).forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }

    function showImage(src) {
        const modal = new bootstrap.Modal(document.getElementById('imageModal'));
        document.getElementById('modalImage').src = src;
        modal.show();
        productCarousel.pause();
        document.getElementById('imageModal').addEventListener('hidden.bs.modal', function () {
            productCarousel.cycle();
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }, { once: true });
    }

    document.querySelectorAll('.rating-input input').forEach(star => {
        star.addEventListener('change', function() {
            const rating = this.value;
            document.querySelectorAll('.rating-star').forEach((label, i) => {
                const icon = label.querySelector('i');
                if (i >= 5 - rating) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                } else {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                }
            });
        });
    });

    document.querySelectorAll('.add-to-cart-form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const productId = this.querySelector('.add-to-cart-detail').getAttribute('data-product-id');
            const quantity = this.querySelector('input[name="quantity"]').value;
            const csrfToken = this.querySelector('input[name="csrfmiddlewaretoken"]').value;

            if (!quantity || quantity <= 0) {
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: 'Veuillez sélectionner une quantité valide.',
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#dc3545",
                    }).showToast();
                } else {
                    alert('Veuillez sélectionner une quantité valide.');
                }
                return;
            }

            fetch(`/cart/add/${productId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: `quantity=${encodeURIComponent(quantity)}`,
                credentials: 'same-origin'
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Erreur HTTP ${response.status}: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const button = this.querySelector('.add-to-cart-detail');
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check me-2"></i>Ajouté !';
                    button.classList.remove('btn-primary');
                    button.classList.add('btn-success');
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.classList.remove('btn-success');
                        button.classList.add('btn-primary');
                    }, 2000);
                    const cartCount = document.querySelector('.cart-count');
                    if (cartCount) cartCount.textContent = data.cart_count;
                    if (typeof Toastify !== 'undefined') {
                        Toastify({
                            text: data.message,
                            duration: 3000,
                            close: true,
                            gravity: "top",
                            position: "right",
                            backgroundColor: "#28a745",
                        }).showToast();
                    } else {
                        alert(data.message);
                    }
                } else {
                    if (typeof Toastify !== 'undefined') {
                        Toastify({
                            text: data.message || "Erreur lors de l'ajout au panier.",
                            duration: 3000,
                            close: true,
                            gravity: "top",
                            position: "right",
                            backgroundColor: "#dc3545",
                        }).showToast();
                    } else {
                        alert(data.message || "Erreur lors de l'ajout au panier.");
                    }
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `Erreur lors de l'ajout au panier: ${error.message}`,
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#dc3545",
                    }).showToast();
                } else {
                    alert(`Erreur lors de l'ajout au panier: ${error.message}`);
                }
            });
        });
    });

    document.querySelectorAll('.toggle-favorite').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const productId = this.getAttribute('data-product-id');
            const isFavorite = this.getAttribute('data-is-favorite') === 'true';
            const csrfToken = getCookie('csrftoken');
            const icon = this.querySelector('i');
            const textSpan = this.querySelector('span');
            
            if (!csrfToken) {
                console.error('CSRF token manquant');
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: "Erreur: Jeton CSRF manquant.",
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#dc3545",
                    }).showToast();
                } else {
                    alert('Erreur: Jeton CSRF manquant.');
                }
                return;
            }

            fetch(`/products/${productId}/toggle-favorite/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Erreur HTTP ${response.status}: ${text}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.status === 'success') {
                    if (data.action === 'added') {
                        icon.classList.add('text-danger');
                        textSpan.textContent = 'Retirer';
                        if (typeof Toastify !== 'undefined') {
                            Toastify({
                                text: "Produit ajouté aux favoris",
                                duration: 3000,
                                close: true,
                                gravity: "top",
                                position: "right",
                                backgroundColor: "#28a745",
                            }).showToast();
                        } else {
                            alert("Produit ajouté aux favoris");
                        }
                    } else {
                        icon.classList.remove('text-danger');
                        textSpan.textContent = 'Ajouter';
                        if (typeof Toastify !== 'undefined') {
                            Toastify({
                                text: "Produit retiré des favoris",
                                duration: 3000,
                                close: true,
                                gravity: "top",
                                position: "right",
                                backgroundColor: "#dc3545",
                            }).showToast();
                        } else {
                            alert("Produit retiré des favoris");
                        }
                    }
                    const favoriteCountElement = document.querySelector('.favorite-count');
                    if (favoriteCountElement) favoriteCountElement.textContent = data.favorite_count;
                    this.setAttribute('data-is-favorite', data.action === 'added' ? 'true' : 'false');
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                if (typeof Toastify !== 'undefined') {
                    Toastify({
                        text: `Erreur lors de la mise à jour des favoris: ${error.message}`,
                        duration: 3000,
                        close: true,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#dc3545",
                    }).showToast();
                } else {
                    alert(`Erreur lors de la mise à jour des favoris: ${error.message}`);
                }
            });
        });
    });
});