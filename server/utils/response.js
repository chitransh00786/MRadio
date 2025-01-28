export const successRes = (data, message = "Request Successul") => ({
    status: true,
    message: message,
    data: data,
    error: null
})

export const errorRes = (error, message = "Request Failed") => ({
    status: false,
    message: message,
    data: null,
    error: error,
})