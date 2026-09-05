// utils/notify.js

import axios from "axios";
import { Resend } from "resend";

import {
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
} from "./orderTemplates.js";

/* =====================================================
   RESEND
===================================================== */

if (!process.env.RESEND_API_KEY) {
  console.warn("⚠️ RESEND_API_KEY is not set in environment variables");
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.MAIL_FROM || "WAGBA <support@wagba.com>";

/* =====================================================
   SAFE SENDER
===================================================== */

const safeSend = async (fn, label) => {
  try {
    return await fn();
  } catch (error) {
    console.error(`❌ ${label} failed:`, error.message);
    console.error(error);

    return null;
  }
};

/* =====================================================
   SEND EMAIL
===================================================== */

const sendEmail = async ({ to, subject, html }) => {
  if (!to) {
    return null;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ Email skipped: RESEND_API_KEY missing");
    return null;
  }

  return safeSend(async () => {
    const response = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    console.log("📧 WAGBA email sent to:", to);

    return response;
  }, "Email");
};

/* =====================================================
   SEND SMS
===================================================== */

const sendSMS = async ({ to, message }) => {
  if (!to) {
    return null;
  }

  if (!process.env.BIRD_API_KEY) {
    console.warn("⚠️ SMS skipped: BIRD_API_KEY missing");
    return null;
  }

  return safeSend(async () => {
    const response = await axios.post(
      "https://eu1.platform.bird.com/v1/sms/messages",
      {
        to,
        from: process.env.BIRD_SENDER_ID,
        text: message,
        category: "transaction",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.BIRD_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("📱 WAGBA SMS sent to:", to);

    return response.data;
  }, "SMS");
};

/* =====================================================
   OTP
===================================================== */

const sendOTP = async ({ email, phone, otp }) => {
  const html = `
    <div style="font-family:Arial,sans-serif;">
      <h2>WAGBA Verification Code</h2>

      <p>
        Your verification code is:
      </p>

      <h1>${otp}</h1>

      <p>
        This code expires in 10 minutes.
      </p>

      <p>
        Do not share this code with anyone.
      </p>
    </div>
  `;

  if (email) {
    await sendEmail({
      to: email,
      subject: "WAGBA Verification Code",
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: otpSMS({
        otp,
        expires: 10,
      }),
    });
  }
};

/* =====================================================
   ORDER CONFIRMED
===================================================== */

const sendOrderConfirmation = async ({
  email,
  phone,

  customerName,
  orderId,
  restaurantName,

  items,

  subtotal,
  deliveryFee,
  serviceFee,
  total,

  paymentMethod,
  paymentStatus,

  deliveryAddress,
}) => {
  const html = orderConfirmedTemplate({
    customerName,
    orderId,
    restaurantName,
    items,
    subtotal,
    deliveryFee,
    serviceFee,
    total,
    paymentMethod,
    paymentStatus,
    deliveryAddress,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Order Confirmed - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: orderConfirmedSMS({
        customerName,
        orderId,
        restaurantName,
        total,
      }),
    });
  }
};

/* =====================================================
   ORDER STATUS
===================================================== */

const sendOrderStatusUpdate = async ({
  email,
  phone,

  customerName,
  orderId,
  restaurantName,

  status,
  message,
  estimatedTime,
}) => {
  const html = orderStatusTemplate({
    customerName,
    orderId,
    restaurantName,
    status,
    message,
    estimatedTime,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Order ${status} - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: orderStatusSMS({
        orderId,
        status,
        estimatedTime,
      }),
    });
  }
};

/* =====================================================
   PAYMENT SUCCESSFUL
===================================================== */

const sendPaymentSuccessful = async ({
  email,
  phone,

  customerName,
  orderId,

  amount,
  paymentReference,
  paymentMethod,

  currency = "₦",
}) => {
  const html = paymentSuccessfulTemplate({
    customerName,
    orderId,
    amount,
    paymentReference,
    paymentMethod,
    currency,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Payment Successful - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: paymentSuccessfulSMS({
        orderId,
        amount,
        paymentReference,
      }),
    });
  }
};

/* =====================================================
   PAYMENT FAILED
===================================================== */

const sendPaymentFailed = async ({
  email,
  phone,

  customerName,
  orderId,

  amount,
  paymentReference,
  reason,
}) => {
  const html = paymentFailedTemplate({
    customerName,
    orderId,
    amount,
    paymentReference,
    reason,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Payment Failed - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: paymentFailedSMS({
        orderId,
        amount,
      }),
    });
  }
};

/* =====================================================
   DELIVERY FEE
===================================================== */

const sendDeliveryFeeAlert = async ({
  email,
  phone,

  customerName,
  orderId,
  restaurantName,

  deliveryFee,
}) => {
  const html = deliveryFeeTemplate({
    customerName,
    orderId,
    restaurantName,
    deliveryFee,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Delivery Fee - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: deliveryFeeSMS({
        orderId,
        deliveryFee,
      }),
    });
  }
};

/* =====================================================
   ORDER CANCELLED
===================================================== */

const sendOrderCancelled = async ({
  email,
  phone,

  customerName,
  orderId,
  restaurantName,

  reason,
}) => {
  const html = orderCancelledTemplate({
    customerName,
    orderId,
    restaurantName,
    reason,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Order Cancelled - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: orderCancelledSMS({
        orderId,
        reason,
      }),
    });
  }
};

/* =====================================================
   REFUND
===================================================== */

const sendRefundNotification = async ({
  email,
  phone,

  customerName,
  orderId,

  amount,
  refundReference,
  refundMethod,
}) => {
  const html = refundTemplate({
    customerName,
    orderId,
    amount,
    refundReference,
    refundMethod,
  });

  if (email) {
    await sendEmail({
      to: email,
      subject: `WAGBA Refund Processed - ${orderId}`,
      html,
    });
  }

  if (phone) {
    await sendSMS({
      to: phone,
      message: refundSMS({
        orderId,
        amount,
        refundReference,
      }),
    });
  }
};

/* =====================================================
   EXPORTS
===================================================== */

export {
  sendEmail,
  sendSMS,
  sendOTP,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendPaymentSuccessful,
  sendPaymentFailed,
  sendDeliveryFeeAlert,
  sendOrderCancelled,
  sendRefundNotification,
};
