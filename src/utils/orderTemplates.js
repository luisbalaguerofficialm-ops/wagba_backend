// utils/orderTemplates.js

const APP_NAME = "WAGBA";

const LOGO_URL =
  process.env.WAGBA_LOGO_URL ||
  process.env.APP_LOGO_URL ||
  "https://res.cloudinary.com/dikpj9nfr/image/upload/v1783792163/wagba_logo.png";

const CURRENCY = "₦";

/* ============================
   SAFE NUMBER FORMATTER
============================ */

const formatMoney = (value) => {
  const num = Number(value);

  if (Number.isNaN(num)) {
    return "0";
  }

  return num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/* ============================
   SAFE TEXT
============================ */

const safeText = (value, fallback = "N/A") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
};

/* ============================
   BASE EMAIL LAYOUT
============================ */

const baseLayout = ({ title, body }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeText(title, APP_NAME)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f5f5;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="padding:30px 10px;"
  >
    <tr>
      <td align="center">

        <table
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="
            max-width:600px;
            width:100%;
            background:#ffffff;
            border-radius:12px;
            overflow:hidden;
          "
        >

          <!-- HEADER -->
          <tr>
            <td
              style="
                background:#ff6b00;
                padding:28px 20px;
                text-align:center;
              "
            >

              <img
                src="${LOGO_URL}"
                width="100"
                alt="${APP_NAME} Logo"
                style="
                  display:block;
                  margin:0 auto;
                  max-width:100px;
                "
              />

              <h2
                style="
                  color:#ffffff;
                  margin:12px 0 0;
                  font-size:24px;
                "
              >
                ${APP_NAME}
              </h2>

            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td
              style="
                padding:30px;
                color:#333333;
                font-size:14px;
                line-height:1.7;
              "
            >
              ${body}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              style="
                background:#f7f7f7;
                padding:18px;
                text-align:center;
                font-size:12px;
                color:#777777;
              "
            >
              © ${new Date().getFullYear()} ${APP_NAME}.
              All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;

/* =====================================================
   1. ORDER CONFIRMED
===================================================== */

const orderConfirmedTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  restaurantName = "Restaurant",
  items = [],
  subtotal = 0,
  deliveryFee = 0,
  serviceFee = 0,
  total = 0,
  paymentMethod = "N/A",
  paymentStatus = "Paid",
  deliveryAddress = "N/A",
}) => {
  const itemRows =
    Array.isArray(items) && items.length
      ? items
          .map(
            (item) => `
              <tr>
                <td style="padding:8px 0;">
                  ${safeText(item.name, "Food Item")}
                  ${item.quantity ? ` × ${safeText(item.quantity, "1")}` : ""}
                </td>

                <td
                  style="
                    padding:8px 0;
                    text-align:right;
                  "
                >
                  ${CURRENCY}${formatMoney(item.price || 0)}
                </td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="2" style="padding:8px 0;">
              Order items
            </td>
          </tr>
        `;

  return baseLayout({
    title: "Order Confirmed",
    body: `
      <h3 style="margin-top:0;color:#222;">
        Order Confirmed 🎉
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        Your order from
        <b>${safeText(restaurantName)}</b>
        has been received successfully.
      </p>

      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="
          margin-top:20px;
          border-collapse:collapse;
        "
      >

        <tr>
          <td style="padding:8px 0;">
            <b>Order ID</b>
          </td>

          <td style="padding:8px 0;text-align:right;">
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td style="padding:8px 0;">
            <b>Restaurant</b>
          </td>

          <td style="padding:8px 0;text-align:right;">
            ${safeText(restaurantName)}
          </td>
        </tr>

      </table>

      <hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" />

      <h4 style="margin-bottom:10px;">
        Order Items
      </h4>

      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="border-collapse:collapse;"
      >
        ${itemRows}
      </table>

      <hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" />

      <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="border-collapse:collapse;"
      >

        <tr>
          <td style="padding:6px 0;">
            Subtotal
          </td>

          <td style="padding:6px 0;text-align:right;">
            ${CURRENCY}${formatMoney(subtotal)}
          </td>
        </tr>

        <tr>
          <td style="padding:6px 0;">
            Delivery Fee
          </td>

          <td style="padding:6px 0;text-align:right;">
            ${CURRENCY}${formatMoney(deliveryFee)}
          </td>
        </tr>

        ${
          Number(serviceFee) > 0
            ? `
              <tr>
                <td style="padding:6px 0;">
                  Service Fee
                </td>

                <td style="padding:6px 0;text-align:right;">
                  ${CURRENCY}${formatMoney(serviceFee)}
                </td>
              </tr>
            `
            : ""
        }

        <tr>
          <td style="padding:10px 0;">
            <b>Total</b>
          </td>

          <td
            style="
              padding:10px 0;
              text-align:right;
              color:#ff6b00;
              font-size:18px;
            "
          >
            <b>${CURRENCY}${formatMoney(total)}</b>
          </td>
        </tr>

      </table>

      <div
        style="
          background:#fff7f0;
          padding:15px;
          border-radius:8px;
          margin-top:20px;
        "
      >

        <p style="margin:4px 0;">
          <b>Payment Method:</b>
          ${safeText(paymentMethod)}
        </p>

        <p style="margin:4px 0;">
          <b>Payment Status:</b>
          ${safeText(paymentStatus)}
        </p>

        <p style="margin:4px 0;">
          <b>Delivery Address:</b>
          ${safeText(deliveryAddress)}
        </p>

      </div>

      <p style="margin-top:25px;">
        You can track your order from your WAGBA account.
      </p>

      <p>
        Thank you for ordering with <b>${APP_NAME}</b>.
      </p>
    `,
  });
};

/* =====================================================
   2. ORDER STATUS UPDATE
===================================================== */

const orderStatusTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  restaurantName = "Restaurant",
  status = "Processing",
  message = "",
  estimatedTime = "",
}) => {
  const statusColors = {
    Pending: "#f0ad4e",
    Confirmed: "#28a745",
    Preparing: "#ff9800",
    Ready: "#2196f3",
    "Out for Delivery": "#673ab7",
    Delivered: "#28a745",
    Cancelled: "#dc3545",
    Failed: "#dc3545",
  };

  return baseLayout({
    title: `Order ${status}`,
    body: `
      <h3 style="margin-top:0;">
        Order ${safeText(status)}
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        There is an update regarding your order from
        <b>${safeText(restaurantName)}</b>.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="
          border-collapse:collapse;
          margin-top:20px;
        "
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Status</b>
          </td>

          <td
            style="
              color:${statusColors[status] || "#333333"};
            "
          >
            <b>${safeText(status)}</b>
          </td>
        </tr>

        ${
          estimatedTime
            ? `
              <tr>
                <td>
                  <b>Estimated Time</b>
                </td>

                <td>
                  ${safeText(estimatedTime)}
                </td>
              </tr>
            `
            : ""
        }

        <tr>
          <td>
            <b>Date</b>
          </td>

          <td>
            ${new Date().toLocaleString("en-NG")}
          </td>
        </tr>

      </table>

      ${
        message
          ? `
            <div
              style="
                background:#f8f8f8;
                padding:15px;
                border-radius:8px;
                margin-top:20px;
              "
            >
              ${safeText(message)}
            </div>
          `
          : ""
      }

      <p style="margin-top:25px;">
        Thank you for choosing ${APP_NAME}.
      </p>
    `,
  });
};

/* =====================================================
   3. PAYMENT SUCCESSFUL
===================================================== */

const paymentSuccessfulTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  amount = 0,
  paymentReference = "N/A",
  paymentMethod = "N/A",
  currency = CURRENCY,
}) =>
  baseLayout({
    title: "Payment Successful",
    body: `
      <h3 style="margin-top:0;color:#28a745;">
        Payment Successful ✓
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        Your payment for your WAGBA order was completed successfully.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="
          border-collapse:collapse;
          margin-top:20px;
        "
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Amount</b>
          </td>

          <td style="color:#28a745;">
            <b>${currency}${formatMoney(amount)}</b>
          </td>
        </tr>

        <tr>
          <td>
            <b>Payment Method</b>
          </td>

          <td>
            ${safeText(paymentMethod)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Payment Reference</b>
          </td>

          <td>
            ${safeText(paymentReference)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Status</b>
          </td>

          <td style="color:#28a745;">
            <b>Successful</b>
          </td>
        </tr>

        <tr>
          <td>
            <b>Date</b>
          </td>

          <td>
            ${new Date().toLocaleString("en-NG")}
          </td>
        </tr>

      </table>

      <p style="margin-top:25px;">
        Your order can now continue to the restaurant.
      </p>
    `,
  });

/* =====================================================
   4. PAYMENT FAILED
===================================================== */

const paymentFailedTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  amount = 0,
  paymentReference = "N/A",
  reason = "Payment could not be completed.",
}) =>
  baseLayout({
    title: "Payment Failed",
    body: `
      <h3 style="margin-top:0;color:#dc3545;">
        Payment Failed
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        We were unable to complete the payment for your order.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="border-collapse:collapse;margin-top:20px;"
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Amount</b>
          </td>

          <td>
            ${CURRENCY}${formatMoney(amount)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Reference</b>
          </td>

          <td>
            ${safeText(paymentReference)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Status</b>
          </td>

          <td style="color:#dc3545;">
            <b>Failed</b>
          </td>
        </tr>

      </table>

      <p style="margin-top:20px;">
        <b>Reason:</b> ${safeText(reason)}
      </p>

      <p>
        Please try the payment again from your WAGBA order page.
      </p>
    `,
  });

/* =====================================================
   5. DELIVERY FEE
===================================================== */

const deliveryFeeTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  restaurantName = "Restaurant",
  deliveryFee = 0,
}) =>
  baseLayout({
    title: "Delivery Fee",
    body: `
      <h3 style="margin-top:0;">
        Delivery Fee
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        Your order from <b>${safeText(restaurantName)}</b>
        has a delivery fee associated with it.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="border-collapse:collapse;margin-top:20px;"
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Delivery Fee</b>
          </td>

          <td>
            ${CURRENCY}${formatMoney(deliveryFee)}
          </td>
        </tr>

      </table>
    `,
  });

/* =====================================================
   6. ORDER CANCELLED
===================================================== */

const orderCancelledTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  restaurantName = "Restaurant",
  reason = "Your order has been cancelled.",
}) =>
  baseLayout({
    title: "Order Cancelled",
    body: `
      <h3 style="margin-top:0;color:#dc3545;">
        Order Cancelled
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        Your order from
        <b>${safeText(restaurantName)}</b>
        has been cancelled.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="border-collapse:collapse;margin-top:20px;"
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Status</b>
          </td>

          <td style="color:#dc3545;">
            <b>Cancelled</b>
          </td>
        </tr>

      </table>

      <p style="margin-top:20px;">
        <b>Reason:</b> ${safeText(reason)}
      </p>

      <p>
        If a refund is applicable, it will be processed according
        to the payment method used.
      </p>
    `,
  });

/* =====================================================
   7. REFUND / WALLET CREDIT
===================================================== */

const refundTemplate = ({
  customerName = "Customer",
  orderId = "N/A",
  amount = 0,
  refundReference = "N/A",
  refundMethod = "Original payment method",
}) =>
  baseLayout({
    title: "Refund Processed",
    body: `
      <h3 style="margin-top:0;color:#28a745;">
        Refund Processed
      </h3>

      <p>
        Hello <b>${safeText(customerName)}</b>,
      </p>

      <p>
        A refund has been processed for your WAGBA order.
      </p>

      <table
        width="100%"
        cellpadding="8"
        cellspacing="0"
        style="border-collapse:collapse;margin-top:20px;"
      >

        <tr>
          <td>
            <b>Order ID</b>
          </td>

          <td>
            ${safeText(orderId)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Refund Amount</b>
          </td>

          <td style="color:#28a745;">
            <b>${CURRENCY}${formatMoney(amount)}</b>
          </td>
        </tr>

        <tr>
          <td>
            <b>Refund Method</b>
          </td>

          <td>
            ${safeText(refundMethod)}
          </td>
        </tr>

        <tr>
          <td>
            <b>Refund Reference</b>
          </td>

          <td>
            ${safeText(refundReference)}
          </td>
        </tr>

      </table>

      <p style="margin-top:20px;">
        Depending on your payment method, the refund may take
        some time to appear in your account.
      </p>
    `,
  });

/* =====================================================
   8. OTP SMS
===================================================== */

const otpSMS = ({ otp = "", expires = 10 }) => {
  return `${APP_NAME}

Your verification code is:

${otp}

This code expires in ${expires} minutes.

Do not share this code with anyone.`;
};

/* =====================================================
   9. ORDER CONFIRMED SMS
===================================================== */

const orderConfirmedSMS = ({
  customerName = "Customer",
  orderId = "",
  restaurantName = "",
  total = 0,
}) => {
  return `${APP_NAME}

Order Confirmed

Hello ${customerName},

Your order from ${restaurantName} has been confirmed.

Order ID:
${orderId}

Total:
${CURRENCY}${formatMoney(total)}

You can track your order from your WAGBA account.`;
};

/* =====================================================
   10. ORDER STATUS SMS
===================================================== */

const orderStatusSMS = ({
  orderId = "",
  status = "Processing",
  estimatedTime = "",
}) => {
  return `${APP_NAME}

Order Update

Order ID:
${orderId}

Status:
${status}

${
  estimatedTime
    ? `Estimated Time:
${estimatedTime}`
    : ""
}

Track your order in the WAGBA app.`;
};

/* =====================================================
   11. PAYMENT SUCCESSFUL SMS
===================================================== */

const paymentSuccessfulSMS = ({
  orderId = "",
  amount = 0,
  paymentReference = "",
}) => {
  return `${APP_NAME}

Payment Successful

Order ID:
${orderId}

Amount:
${CURRENCY}${formatMoney(amount)}

Payment Reference:
${paymentReference}

Your payment has been confirmed.`;
};

/* =====================================================
   12. PAYMENT FAILED SMS
===================================================== */

const paymentFailedSMS = ({ orderId = "", amount = 0 }) => {
  return `${APP_NAME}

Payment Failed

Order ID:
${orderId}

Amount:
${CURRENCY}${formatMoney(amount)}

Your payment could not be completed.

Please try again from your WAGBA order page.`;
};

/* =====================================================
   13. DELIVERY FEE SMS
===================================================== */

const deliveryFeeSMS = ({ orderId = "", deliveryFee = 0 }) => {
  return `${APP_NAME}

Delivery Fee

Order ID:
${orderId}

Delivery Fee:
${CURRENCY}${formatMoney(deliveryFee)}

Check your WAGBA order for more details.`;
};

/* =====================================================
   14. ORDER CANCELLED SMS
===================================================== */

const orderCancelledSMS = ({ orderId = "", reason = "" }) => {
  return `${APP_NAME}

Order Cancelled

Order ID:
${orderId}

Reason:
${reason || "Your order has been cancelled."}

Please check your WAGBA account for more details.`;
};

/* =====================================================
   15. REFUND SMS
===================================================== */

const refundSMS = ({ orderId = "", amount = 0, refundReference = "" }) => {
  return `${APP_NAME}

Refund Processed

Order ID:
${orderId}

Refund Amount:
${CURRENCY}${formatMoney(amount)}

Refund Reference:
${refundReference}

Your refund has been processed.`;
};

/* =====================================================
   EXPORTS
===================================================== */

export {
  orderConfirmedTemplate,
  orderStatusTemplate,
  paymentSuccessfulTemplate,
  paymentFailedTemplate,
  deliveryFeeTemplate,
  orderCancelledTemplate,
  refundTemplate,
  orderConfirmedSMS,
  orderStatusSMS,
  paymentSuccessfulSMS,
  paymentFailedSMS,
  deliveryFeeSMS,
  orderCancelledSMS,
  refundSMS,
  otpSMS,
};
