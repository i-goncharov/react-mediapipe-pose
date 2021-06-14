import axios from 'axios'
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'

const defaultJsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'Access-Control-Allow-Origin': '*',
}

const _url = (url) => `http://localhost:5000/${url.replace(/^\/+/, '')}`

const apiFetchData = async ({url, method, headers = {}, data = {}, params = {}, config = {}}) => {
  try {
    const res = await axios({
      url: _url(url),
      method,
      data,
      params,
      headers: {
        ...defaultJsonHeaders,
        ...headers,
      },
      ...config,
    })
    return res.data
  } catch (e) {
    throw e
  }
}

export const createFile = async (data) => {
  return await apiFetchData({url: '/landmarks', method: 'post', data})
}
