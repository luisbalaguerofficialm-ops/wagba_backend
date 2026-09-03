import SystemSettings from "../models/systemsettings.model.js";
import tryCatchFn from "../libs/tryCatchFn.js";

// ==========================================
// HELPER: GET OR CREATE SYSTEM SETTINGS
// ==========================================

const getOrCreateSettings = async () => {
  let settings = await SystemSettings.findOne();

  if (!settings) {
    settings = await SystemSettings.create({
      rolePermissions: [
        {
          role: "Admin",
          permissions: {
            manageOrders: true,
            editProducts: true,
            viewRevenue: true,
            deleteUsers: true,
          },
        },
        {
          role: "Manager",
          permissions: {
            manageOrders: true,
            editProducts: true,
            viewRevenue: true,
            deleteUsers: false,
          },
        },
        {
          role: "Support",
          permissions: {
            manageOrders: true,
            editProducts: false,
            viewRevenue: false,
            deleteUsers: false,
          },
        },
        {
          role: "Delivery Lead",
          permissions: {
            manageOrders: true,
            editProducts: false,
            viewRevenue: false,
            deleteUsers: false,
          },
        },
      ],
    });
  }

  return settings;
};

// ==========================================
// GET SYSTEM SETTINGS
// GET /api/admin/settings
// ==========================================

export const getSettings = tryCatchFn(async (req, res) => {
  const settings = await getOrCreateSettings();

  return res.status(200).json({
    success: true,
    data: settings,
  });
});

// ==========================================
// UPDATE FULL SYSTEM SETTINGS
// PUT /api/admin/settings
// ==========================================

export const updateSettings = tryCatchFn(async (req, res) => {
  const settings = await getOrCreateSettings();

  const allowedFields = [
    "platformStatus",
    "maintenanceMode",
    "defaultCurrency",
    "serviceFeePercentage",
    "onlinePaymentsEnabled",
    "paymentDestination",
    "rolePermissions",
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  await settings.save();

  return res.status(200).json({
    success: true,
    message: "Settings updated successfully",
    data: settings,
  });
});

// ==========================================
// UPDATE BANK DETAILS
// PATCH /api/admin/settings/bank
// ==========================================

export const updateBankDetails = tryCatchFn(async (req, res) => {
  const { accountName, bankName, accountNumber, accountType, currency } =
    req.body;

  const settings = await getOrCreateSettings();

  settings.bankAccount = {
    accountName: accountName ?? settings.bankAccount?.accountName ?? "",

    bankName: bankName ?? settings.bankAccount?.bankName ?? "",

    accountNumber: accountNumber ?? settings.bankAccount?.accountNumber ?? "",

    accountType: accountType ?? settings.bankAccount?.accountType ?? "Current",

    currency: currency ?? settings.bankAccount?.currency ?? "NGN",
  };

  await settings.save();

  return res.status(200).json({
    success: true,
    message: "Bank account updated successfully",
    data: settings.bankAccount,
  });
});

// ==========================================
// UPDATE CRYPTO WALLET
// PATCH /api/admin/settings/crypto
// ==========================================

export const updateCryptoWallet = tryCatchFn(async (req, res) => {
  const { asset, network, walletAddress } = req.body;

  const settings = await getOrCreateSettings();

  settings.cryptoWallet = {
    asset: asset ?? settings.cryptoWallet?.asset ?? "USDT",

    network: network ?? settings.cryptoWallet?.network ?? "",

    walletAddress: walletAddress ?? settings.cryptoWallet?.walletAddress ?? "",
  };

  await settings.save();

  return res.status(200).json({
    success: true,
    message: "Crypto wallet updated successfully",
    data: settings.cryptoWallet,
  });
});

// ==========================================
// ADD ROLE
// POST /api/admin/settings/roles
// ==========================================

export const addRole = tryCatchFn(async (req, res) => {
  const { role, permissions } = req.body;

  if (!role || !role.trim()) {
    return res.status(400).json({
      success: false,
      message: "Role name is required",
    });
  }

  const settings = await getOrCreateSettings();

  const existingRole = settings.rolePermissions.find(
    (item) => item.role.toLowerCase() === role.trim().toLowerCase(),
  );

  if (existingRole) {
    return res.status(409).json({
      success: false,
      message: "Role already exists",
    });
  }

  const allowedRoles = ["Admin", "Manager", "Support", "Delivery Lead"];

  const normalizedRole = allowedRoles.find(
    (item) => item.toLowerCase() === role.trim().toLowerCase(),
  );

  if (!normalizedRole) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
    });
  }

  settings.rolePermissions.push({
    role: normalizedRole,
    permissions: {
      manageOrders: permissions?.manageOrders ?? false,

      editProducts: permissions?.editProducts ?? false,

      viewRevenue: permissions?.viewRevenue ?? false,

      deleteUsers: permissions?.deleteUsers ?? false,
    },
  });

  await settings.save();

  return res.status(201).json({
    success: true,
    message: "Role created successfully",
    data: settings.rolePermissions,
  });
});

// ==========================================
// UPDATE ROLE
// PATCH /api/admin/settings/roles/:role
// ==========================================

export const updateRole = tryCatchFn(async (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;

  if (!role) {
    return res.status(400).json({
      success: false,
      message: "Role is required",
    });
  }

  const settings = await getOrCreateSettings();

  const rolePermission = settings.rolePermissions.find(
    (item) => item.role.toLowerCase() === role.toLowerCase(),
  );

  if (!rolePermission) {
    return res.status(404).json({
      success: false,
      message: "Role not found",
    });
  }

  if (permissions) {
    rolePermission.permissions.manageOrders =
      permissions.manageOrders ?? rolePermission.permissions.manageOrders;

    rolePermission.permissions.editProducts =
      permissions.editProducts ?? rolePermission.permissions.editProducts;

    rolePermission.permissions.viewRevenue =
      permissions.viewRevenue ?? rolePermission.permissions.viewRevenue;

    rolePermission.permissions.deleteUsers =
      permissions.deleteUsers ?? rolePermission.permissions.deleteUsers;
  }

  await settings.save();

  return res.status(200).json({
    success: true,
    message: "Role updated successfully",
    data: rolePermission,
  });
});

// ==========================================
// DELETE ROLE
// DELETE /api/admin/settings/roles/:role
// ==========================================

export const deleteRole = tryCatchFn(async (req, res) => {
  const { role } = req.params;

  if (!role) {
    return res.status(400).json({
      success: false,
      message: "Role is required",
    });
  }

  const settings = await getOrCreateSettings();

  const originalLength = settings.rolePermissions.length;

  settings.rolePermissions = settings.rolePermissions.filter(
    (item) => item.role.toLowerCase() !== role.toLowerCase(),
  );

  if (settings.rolePermissions.length === originalLength) {
    return res.status(404).json({
      success: false,
      message: "Role not found",
    });
  }

  await settings.save();

  return res.status(200).json({
    success: true,
    message: "Role deleted successfully",
    data: settings.rolePermissions,
  });
});

// ==========================================
// DEFAULT EXPORT
// ==========================================

const systemSettingsController = {
  getSettings,
  updateSettings,
  updateBankDetails,
  updateCryptoWallet,
  addRole,
  updateRole,
  deleteRole,
};

export default systemSettingsController;
