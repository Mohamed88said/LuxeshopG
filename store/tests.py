import pytest
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from channels.testing import WebsocketCommunicator
from store.models import Product, Category, Cart, CartItem, Order, OrderItem, Notification, GuineaAddress, GuineaRegion, GuineaPrefecture, GuineaQuartier
from store.forms import ProductForm, GuineaAddressForm
from store.consumers import NotificationConsumer
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.messages import get_messages
from decimal import Decimal
import json

# Obtenir le modèle d'utilisateur personnalisé
User = get_user_model()

# Tests pour les modèles
class ModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.seller = User.objects.create_user(username='seller', password='testpass123')
        # Assurez-vous que user_type existe dans votre modèle CustomUser
        self.seller.user_type = 'seller'
        self.seller.save()
        self.category = Category.objects.create(name='Electronics')
        self.product = Product.objects.create(
            name='Test Product',
            price=100.00,
            stock=10,
            category=self.category,
            seller=self.seller,
            description='A test product'
        )

    def test_product_discounted_price(self):
        """Teste le calcul du prix réduit si une réduction est appliquée."""
        from store.models import Discount
        Discount.objects.create(
            product=self.product,
            percentage=20,
            start_date='2025-07-01',
            end_date='2025-08-01'
        )
        self.assertEqual(self.product.discounted_price, Decimal('80.00'))

    def test_cart_total_price(self):
        """Teste le calcul du prix total du panier."""
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        self.assertEqual(cart.total_price, Decimal('200.00'))

    def test_order_creation(self):
        """Teste la création d'une commande."""
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        order = Order.objects.create(user=self.user, total_amount=Decimal('200.00'))
        OrderItem.objects.create(order=order, product=self.product, quantity=2, price=Decimal('100.00'))
        self.assertEqual(order.order_items.count(), 1)
        self.assertEqual(order.total_amount, Decimal('200.00'))

    def test_notification_creation(self):
        """Teste la création d'une notification."""
        notification = Notification.objects.create(
            user=self.user,
            message='Test notification',
            notification_type='info'
        )
        self.assertEqual(Notification.objects.filter(user=self.user).count(), 1)
        self.assertEqual(notification.message, 'Test notification')

# Tests pour les formulaires
class FormTests(TestCase):
    def setUp(self):
        self.region = GuineaRegion.objects.create(name='Conakry')
        self.prefecture = GuineaPrefecture.objects.create(name='Kaloum', region=self.region)
        self.quartier = GuineaQuartier.objects.create(name='Tombo', prefecture=self.prefecture)
        self.category = Category.objects.create(name='Electronics')
        self.seller = User.objects.create_user(username='seller', password='testpass123')
        self.seller.user_type = 'seller'
        self.seller.save()

    def test_product_form_valid(self):
        """Teste la validité du formulaire ProductForm."""
        form_data = {
            'name': 'Test Product',
            'price': 100.00,
            'stock': 10,
            'category': self.category.id,
            'description': 'A test product',
            'brand': 'Test Brand',
            'color': 'Black'
        }
        form = ProductForm(data=form_data)
        self.assertTrue(form.is_valid())

    def test_product_form_invalid_price(self):
        """Teste un formulaire ProductForm avec un prix négatif."""
        form_data = {
            'name': 'Test Product',
            'price': -10.00,
            'stock': 10,
            'category': self.category.id,
            'description': 'A test product'
        }
        form = ProductForm(data=form_data)
        self.assertFalse(form.is_valid())
        self.assertIn('price', form.errors)

    def test_guinea_address_form_valid(self):
        """Teste la validité du formulaire GuineaAddressForm."""
        form_data = {
            'region': self.region.id,
            'prefecture': self.prefecture.id,
            'quartier': self.quartier.id,
            'street': 'Main Street',
            'latitude': 9.5,
            'longitude': -13.7
        }
        form = GuineaAddressForm(data=form_data)
        self.assertTrue(form.is_valid())

# Tests pour les vues
class ViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpass123')
        self.seller = User.objects.create_user(username='seller', password='testpass123')
        self.seller.user_type = 'seller'
        self.seller.save()
        self.category = Category.objects.create(name='Electronics')
        self.product = Product.objects.create(
            name='Test Product',
            price=100.00,
            stock=10,
            category=self.category,
            seller=self.seller
        )

    def test_product_list_view(self):
        """Teste l'affichage de la liste des produits."""
        response = self.client.get(reverse('store:product_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Test Product')

    def test_product_create_view_seller_only(self):
        """Teste que seuls les vendeurs peuvent créer un produit."""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('store:product_create'))
        self.assertEqual(response.status_code, 403)  # Accès interdit pour non-vendeurs

        self.client.login(username='seller', password='testpass123')
        response = self.client.get(reverse('store:product_create'))
        self.assertEqual(response.status_code, 200)

    def test_add_to_cart_view(self):
        """Teste l'ajout d'un produit au panier."""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.post(
            reverse('store:add_to_cart', args=[self.product.id]),
            {'quantity': 2}
        )
        self.assertEqual(response.status_code, 302)  # Redirection après ajout
        cart = Cart.objects.get(user=self.user)
        self.assertEqual(cart.items.count(), 1)
        self.assertEqual(cart.items.first().quantity, 2)

    def test_checkout_view(self):
        """Teste la page de paiement."""
        self.client.login(username='testuser', password='testpass123')
        cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)
        response = self.client.get(reverse('store:checkout'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Test Product')

# Tests pour le consommateur WebSocket
@pytest.mark.asyncio
class NotificationConsumerTests(TestCase):
    async def test_notification_consumer(self):
        """Teste l'envoi d'une notification via WebSocket."""
        user = await User.objects.acreate(username='testuser', password='testpass123')
        communicator = WebsocketCommunicator(NotificationConsumer.as_asgi(), '/ws/notifications/')
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Simuler l'envoi d'une notification
        notification = await Notification.objects.acreate(
            user=user,
            message='Test notification',
            notification_type='info'
        )
        await communicator.send_json_to({
            'type': 'send_notification',
            'notification': {
                'id': notification.id,
                'message': notification.message,
                'notification_type': notification.notification_type,
                'created_at': notification.created_at.isoformat()
            }
        })

        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'notification')
        self.assertEqual(response['notification']['message'], 'Test notification')

        await communicator.disconnect()