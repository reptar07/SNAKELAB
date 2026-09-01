/* ============================================================
   SNAKE LAB — Checkout Module
   Handles the checkout process and order creation
   ============================================================ */

const Checkout = {
  selectedPayment: 'transferencia',

  open() {
    if (Cart.items.length === 0) {
      Cart.showToast('Tu carrito está vacío', 'error');
      return;
    }
    this.render();
    document.getElementById('checkout-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  close() {
    document.getElementById('checkout-overlay').classList.remove('show');
    document.body.style.overflow = '';
  },

  render() {
    const modal = document.getElementById('checkout-modal');
    const subtotal = Cart.getTotal();

    modal.innerHTML = `
      <div class="checkout-form-view">
        <h2 class="checkout-title">
          <svg><use href="#icon-credit-card"/></svg>
          Finalizar Compra
        </h2>

        <form id="checkout-form" onsubmit="Checkout.submit(event)">
          <div class="form-group">
            <label class="form-label">Nombre completo *</label>
            <input type="text" class="form-input" id="co-name" placeholder="Tu nombre completo" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" class="form-input" id="co-email" placeholder="correo@ejemplo.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono *</label>
              <input type="tel" class="form-input" id="co-phone" placeholder="300 123 4567" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Dirección de envío *</label>
            <input type="text" class="form-input" id="co-address" placeholder="Calle, número, barrio" required>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Ciudad *</label>
              <input type="text" class="form-input" id="co-city" placeholder="Tu ciudad" required>
            </div>
            <div class="form-group">
              <label class="form-label">Departamento</label>
              <input type="text" class="form-input" id="co-dept" placeholder="Departamento">
            </div>
          </div>

          <h3 class="checkout-section-title">Método de Pago</h3>
          <div class="payment-options">
            <div class="payment-option selected" data-method="transferencia" onclick="Checkout.selectPayment(this)">
              <div class="payment-radio"></div>
              <div class="payment-info">
                <div class="payment-name">Transferencia Bancaria</div>
                <div class="payment-desc">Transferencia directa a nuestra cuenta</div>
              </div>
            </div>
            <div class="payment-option" data-method="nequi" onclick="Checkout.selectPayment(this)">
              <div class="payment-radio"></div>
              <div class="payment-info">
                <div class="payment-name">Nequi</div>
                <div class="payment-desc">Paga fácil desde tu celular</div>
              </div>
            </div>
            <div class="payment-option" data-method="daviplata" onclick="Checkout.selectPayment(this)">
              <div class="payment-radio"></div>
              <div class="payment-info">
                <div class="payment-name">Daviplata</div>
                <div class="payment-desc">Transferencia por Daviplata</div>
              </div>
            </div>
            <div class="payment-option" data-method="efectivo" onclick="Checkout.selectPayment(this)">
              <div class="payment-radio"></div>
              <div class="payment-info">
                <div class="payment-name">Contra Entrega</div>
                <div class="payment-desc">Paga en efectivo al recibir tu pedido</div>
              </div>
            </div>
          </div>

          <div class="checkout-summary">
            <div class="checkout-summary-title">Resumen del Pedido</div>
            <div class="checkout-summary-items">
              ${Cart.items.map(item => `
                <div class="checkout-summary-item">
                  <span>${Security.escapeHtml(item.name)} x${Security.integer(item.quantity, 1)}</span>
                  <span>${Cart.formatPrice(item.price * item.quantity)}</span>
                </div>
              `).join('')}
              <div class="checkout-summary-item" style="font-weight:700; color:var(--text-primary); padding-top:8px; border-top:1px solid var(--border); margin-top:8px;">
                <span>Total</span>
                <span style="color:var(--accent)">${Cart.formatPrice(subtotal)}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notas adicionales</label>
            <textarea class="form-input" id="co-notes" placeholder="Instrucciones especiales, detalles del pedido..." rows="3" style="resize:vertical;"></textarea>
          </div>

          <div class="checkout-actions">
            <button type="button" class="btn btn-secondary" onclick="Checkout.close()">Cancelar</button>
            <button type="submit" class="btn btn-primary">
              <svg><use href="#icon-check-circle"/></svg>
              Confirmar Pedido
            </button>
          </div>
        </form>
      </div>
    `;
  },

  selectPayment(el) {
    document.querySelectorAll('.payment-option').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedPayment = el.dataset.method;
  },

  async submit(e) {
    e.preventDefault();

    const name = document.getElementById('co-name').value.trim();
    const email = document.getElementById('co-email').value.trim();
    const phone = document.getElementById('co-phone').value.trim();
    const address = document.getElementById('co-address').value.trim();
    const city = document.getElementById('co-city').value.trim();
    const department = document.getElementById('co-dept').value.trim();
    const notes = document.getElementById('co-notes').value.trim();

    if (!name || !email || !phone || !address || !city) {
      Cart.showToast('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    try {
      // Register the customer or reuse the existing record. The public API
      // deliberately does not update personal data based only on an email.
      const customer = await API.createCustomer({
        name, email, phone, address, city, department
      });

      // Create order
      const subtotal = Cart.getTotal();
      const order = await API.createOrder({
        checkout_token: customer.checkout_token,
        items: Cart.items,
        subtotal: subtotal,
        tax: 0,
        total: subtotal,
        payment_method: this.selectedPayment,
        notes: notes
      });

      // TODO: FUTURE PAYMENT GATEWAY INTEGRATION
      // Here you would check if the selected method requires a payment gateway 
      // (e.g. MercadoPago, Stripe, PayU).
      /*
      if (this.selectedPayment === 'tarjeta' || this.selectedPayment === 'mercadopago') {
        // 1. Send order details to backend to create a payment preference/intent
        // const preference = await API.createPaymentPreference(order.id);
        // 2. Redirect user to payment URL or open checkout modal
        // window.location.href = preference.init_point; 
        // return; // Stop here, success is handled after redirect
      }
      */

      // Show success
      this.showSuccess(order.id);
      Cart.clear();

    } catch (error) {
      console.error('Checkout error:', error);
      Cart.showToast('Error al procesar tu pedido. Intenta de nuevo.', 'error');
    }
  },

  showSuccess(orderId) {
    const modal = document.getElementById('checkout-modal');
    modal.innerHTML = `
      <div class="checkout-success">
        <svg><use href="#icon-check-circle"/></svg>
        <h2>¡Pedido Confirmado!</h2>
        <p>Tu pedido <strong>#${orderId}</strong> ha sido registrado exitosamente. Te contactaremos pronto para confirmar los detalles del pago y envío.</p>
        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
          <a href="#" class="btn btn-primary" id="success-whatsapp" target="_blank">
            Confirmar por WhatsApp
          </a>
          <button class="btn btn-secondary" onclick="Checkout.close()">
            Seguir Comprando
          </button>
        </div>
      </div>
    `;

    // Set WhatsApp link
    const settings = App.settings || {};
    const waNumber = settings.whatsapp_number || '573001234567';
    const waMessage = encodeURIComponent(`Hola SNAKE LAB! Acabo de realizar el pedido #${orderId} y quiero confirmar los detalles.`);
    const waLink = document.getElementById('success-whatsapp');
    if (waLink) {
      waLink.href = `https://wa.me/${waNumber}?text=${waMessage}`;
    }
  },

  init() {
    document.getElementById('checkout-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'checkout-overlay') this.close();
    });
  }
};
