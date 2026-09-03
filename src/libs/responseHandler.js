//classes are like templates for creating javascript objects. they can inherit existing prototypes of objects. They usually get initialized with a constructor.
//A constructor is a method for creating and initializing an object instance of a class, while the super keyword is used to call and invoke the parent class which gives it access to it properties and methods
class AppError extends Error {
  constructor(message, statusCode = 500, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.success = false;
    this.isOperational = true;
    this.data = data;
  }
}

class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode; //status code to be sent
    this.data = data; //api data to be sent to the client
    this.message = message; //custom msg to be passed, defaults to success if none is passed
    this.success = statusCode < 400; //auto sets success to true for statuscode less than 400
  }
}

const sendResponse = (res, statusCode, data = null, message = null) => {
  const response = new ApiResponse(statusCode, data, message);
  return res.status(statusCode).json({
    success: response.success,
    message: response.message,
    data: response.data,
  });
};

const successResponse = (
  res,
  data,
  message = "Request successful",
  statusCode = 200,
) => {
  return sendResponse(res, statusCode, data, message);
};

const errorResponse = (
  message = "An error occurred",
  statusCode = 500,
  data = null,
) => {
  return new AppError(message, statusCode, data);
};

const notFoundResponse = (message = "Resource not found") => {
  return errorResponse(message, 404);
};

const unauthorizedResponse = (message = "Unauthorized") => {
  return errorResponse(message, 401);
};

const forbiddenResponse = (message = "Forbidden") => {
  return errorResponse(message, 403);
};

export default {
  ApiResponse,
  sendResponse,
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
};
