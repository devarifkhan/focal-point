import axios from 'axios';
import {sessionData} from "../config/sessionKeys";
import {API_BASE_URL, DEFAULT_LANGUAGE} from "../config/config";

function getRequestHeaders(isMultipart = false) {
    const token = localStorage.getItem('access_token');
    const content_type = isMultipart ? 'multipart/form-data' : 'application/json';

    const headers = {
        'Content-Type': content_type,
        'Accept-Language': DEFAULT_LANGUAGE
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

const BASE_URL = API_BASE_URL;

async function get(url, parameter) {
    return axios.get(BASE_URL + url, {
        params: parameter,
        headers: getRequestHeaders()
    });
}

async function post(url, body, isMultipart = false) {
    return axios.post(BASE_URL + url, body, {
        headers: getRequestHeaders(isMultipart)
    });
}

async function put(url, body, isMultipart = false) {
    return axios.put(BASE_URL + url, body, {
        headers: getRequestHeaders(isMultipart)
    });
}

async function patch(url, body) {
    return axios.patch(BASE_URL + url, body, {
        headers: getRequestHeaders()
    });
}

async function remove(url, body) {
    return axios.delete(BASE_URL + url, {
        data: body,
        headers: getRequestHeaders()
    });
}


const AxiosServices = {
    get,
    post,
    put,
    patch,
    remove
};

export default AxiosServices;
