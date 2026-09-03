import User from "../models/user.js" ;

// @desc    Get Current Admin Profile
// @route   GET /api/admin/profile
exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin || !admin.isActive) {
      return res.status(404).json({ success: false, message: "Admin account not found" });
    }
    return res.status(200).json({ success: true, data: admin });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Profile Info & Preferences
// @route   PUT /api/admin/profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const { fullName, email, phone, state, bio, preferences } = req.body;

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    // Assign text fields if provided
    if (fullName) admin.fullName = fullName;
    if (email) admin.email = email;
    if (phone) admin.phone = phone;
    if (state) admin.state = state;
    if (bio) admin.bio = bio;

    // Assign preferences if provided
    if (preferences) {
      if (preferences.language) admin.preferences.language = preferences.language;
      if (typeof preferences.darkMode === "boolean") admin.preferences.darkMode = preferences.darkMode;
      if (preferences.notifications) {
        admin.preferences.notifications = {
          ...admin.preferences.notifications,
          ...preferences.notifications,
        };
      }
    }

    const updatedAdmin = await admin.save();
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedAdmin,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload Avatar Image
// @route   POST /api/admin/profile/avatar
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: { avatar: admin.avatar },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change Password
// @route   PUT /api/admin/profile/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Please provide current and new passwords" });
    }

    const admin = await Admin.findById(req.user.id).select("+password");
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect current password" });
    }

    admin.password = newPassword;
    await admin.save();

    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Deactivate Admin Account (Danger Zone)
// @route   PATCH /api/admin/profile/deactivate
exports.deactivateAccount = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { isActive: false },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};