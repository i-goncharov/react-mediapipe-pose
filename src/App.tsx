import React, {useEffect, useState, useRef} from 'react'
import {Box, Grid, makeStyles, CircularProgress, IconButton, Snackbar, Dialog, Button} from '@material-ui/core'
import {FlipCameraIos, Fullscreen, FullscreenExit, AccessibilityNew} from '@material-ui/icons'
import {Alert} from '@material-ui/lab'

import {createFile} from './services'

import {
  Pose,
  POSE_CONNECTIONS,
  POSE_LANDMARKS_LEFT,
  POSE_LANDMARKS_RIGHT,
  POSE_LANDMARKS_NEUTRAL,
  NormalizedLandmarkList,
  Results,
} from '@mediapipe/pose'
import {drawConnectors, drawLandmarks} from '@mediapipe/drawing_utils'

export type Color = 'success' | 'info' | 'warning' | 'error'

interface AlertMsg {
  color: Color
  msg: string
}

export const App = () => {
  const classes = useStyles()

  const _FRAMES_RECORD_LIMIT = 300

  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  const [fps, setFps] = useState(0)
  const [ready, setReady] = useState(false)
  const alertMsgInitial: AlertMsg = {color: 'info', msg: ''}
  const [alertMsg, setAlertMsg] = useState<AlertMsg>(alertMsgInitial)
  const [front, setFront] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)
  const [record, setRecord] = useState(false)
  const [landmarks, setLandmarks] = useState<NormalizedLandmarkList[]>([])
  const [detector, setDetector] = useState<Pose | null>()
  const [seqLink, setSeqLink] = useState<string | null>(null)

  useEffect(() => {
    const s = `scaleX(${front ? -1 : 1})`
    if (canvas.current && video.current) {
      canvas.current.style.transform = s
      video.current.style.transform = s
    }

    initCamera()
    loadPose()
  }, [])

  useEffect(() => {
    detector &&
      detector.onResults((res) => {
        canvas.current && renderFrame(res, canvas.current.getContext('2d') as CanvasRenderingContext2D, record)
      })
  }, [record])

  const loadPose = async () => {
    setLoading('Pose Assets')

    try {
      const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      })
      pose.setOptions({
        modelComplexity: 2,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      setDetector(pose)

      pose.onResults((res) => {
        canvas.current && renderFrame(res, canvas.current.getContext('2d') as CanvasRenderingContext2D, record)
      })
      await sendFrames(pose)
    } catch (err) {
      setLoading(null)
      setAlertMsg({color: 'error', msg: `${err.message.substring(0, 80)}...`})
      console.error('pose init error:', err)
    }
  }

  const initCamera = async () => {
    try {
      const w = window.innerWidth
      const h = window.innerHeight
      const videoConstraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: front ? 'user' : 'environment',
          width: {ideal: w},
          height: {ideal: h},
          //aspectRatio: {ideal: w >= h ? w / h : h / w},
          frameRate: {ideal: 30},
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(videoConstraints)
      let stream_settings = stream.getVideoTracks()[0].getSettings()
      console.info('camera ready', stream_settings.width, stream_settings.height)

      if (video.current && canvas.current) {
        video.current.srcObject = stream
        await video.current.play()

        video.current.width = video.current.videoWidth
        video.current.height = video.current.videoHeight
        canvas.current.width = video.current.width
        canvas.current.height = video.current.height

        console.log(
          'set sizes',
          canvas.current.width,
          canvas.current.height,
          ':',
          video.current.width,
          video.current.height,
          ':',
          video.current.videoWidth,
          video.current.videoHeight,
        )
      }
    } catch (err) {
      setLoading(null)
      setAlertMsg({color: 'error', msg: `${err.message.substring(0, 80)}...`})
      console.error('Camera init error:', err)
    }
  }

  const sendFrames = async (pose: Pose) => {
    let times: number[] = []
    const loop = async () => {
      if (video.current) {
        await pose.send({image: video.current})

        // fps count
        const now = performance.now()
        while (times.length > 0 && times[0] <= now - 1000) times.shift()
        times.push(now)
        setFps(times.length)

        requestAnimationFrame(loop)
      }
    }
    await loop()

    console.info('detector ready')
    setLoading(null)
    setReady(true)
  }

  const renderFrame = (results: Results, ctx: CanvasRenderingContext2D, rec?: boolean) => {
    if (canvas.current && video.current) {
      ctx.save()
      ctx.clearRect(0, 0, canvas.current.width, canvas.current.height)
      //ctx.drawImage(results.image, 0, 0, canvas.current.width, canvas.current.height)

      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        visibilityMin: 0.65,
        lineWidth: 4,
        color: 'white',
      })

      if (results.poseLandmarks) {
        // Record landmarcs
        if (rec) {
          if (_FRAMES_RECORD_LIMIT > landmarks.length) {
            landmarks.push(results.poseLandmarks)
          } else {
            setAlertMsg({color: 'warning', msg: 'Frames limit'})
            captureToggle()
          }
        }

        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_LEFT).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'green', lineWidth: 2},
        )
        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_RIGHT).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'red', lineWidth: 2},
        )
        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_NEUTRAL).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'black', lineWidth: 2},
        )
      }

      ctx.restore()
    }
  }

  const captureToggle = () => {
    console.log('cap')
    setRecord((prev) => {
      setAlertMsg({
        color: 'info',
        msg: !prev ? 'Start capture' : `Stop capture ${_FRAMES_RECORD_LIMIT == landmarks.length && '- FRAMES LIMIT'}`,
      })
      prev && saveFile()
      return !prev
    })
  }

  const saveFile = async () => {
    const reqBody = JSON.stringify(landmarks)
    console.log(reqBody)
    const file = await createFile(reqBody)
    setSeqLink(file)
    landmarks.length = 0
  }

  const flipCamera = async () => {
    setLoading('...')

    setFront((prev) => {
      const s = `scaleX(${prev ? -1 : 1})`
      if (canvas.current && video.current) {
        canvas.current.style.transform = s
        video.current.style.transform = s
      }
      return !prev
    })

    await initCamera()
    setLoading('')
  }

  const toggleFullScreen = async () => {
    setLoading('...')
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen && (await document.exitFullscreen())
    }
    setLoading('')
  }

  return (
    <React.Fragment>
      <Grid container justify={'center'} alignItems={'center'} style={{height: '100%'}}>
        <Grid item xs={12} style={{position: 'relative', height: '100%'}}>
          <video ref={video} className={classes.video}></video>
          <canvas ref={canvas} className={classes.canvas}></canvas>
        </Grid>

        {loading && (
          <Box className={classes.loader}>
            <Grid container spacing={1} justify={'center'} direction={'column'} alignItems={'center'}>
              <Grid item>
                <CircularProgress />
              </Grid>
              <Grid item>
                <span>Загрузка {loading}</span>
              </Grid>
            </Grid>
          </Box>
        )}

        <Snackbar
          open={alertMsg.msg.length > 0}
          anchorOrigin={{vertical: 'top', horizontal: 'center'}}
          autoHideDuration={6000}
          onClose={() => setAlertMsg(alertMsgInitial)}
        >
          <Alert
            onClose={() => setAlertMsg(alertMsgInitial)}
            elevation={6}
            variant={'filled'}
            severity={alertMsg.color}
          >
            {alertMsg.msg}
          </Alert>
        </Snackbar>

        <Box position={'absolute'} left={5} top={5}>
          <span style={{color: '#fff'}}>{fps}</span>
        </Box>
        {record && <Box className={`${classes.rec} animate__animated animate__bounceIn animate__infinite`}>{''}</Box>}
        <Box position={'absolute'} right={20} bottom={20}>
          <IconButton disabled={!ready} className={classes.button} onClick={flipCamera}>
            <FlipCameraIos />
          </IconButton>
        </Box>
        <Box position={'absolute'} bottom={15}>
          <IconButton disabled={!ready} className={classes.button} style={{padding: 20}} onClick={captureToggle}>
            <AccessibilityNew style={{color: record ? 'red' : 'white'}} />
          </IconButton>
        </Box>
        <Box position={'absolute'} left={20} bottom={20}>
          <IconButton className={classes.button} onClick={toggleFullScreen}>
            {document.fullscreenElement ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Box>
      </Grid>

      <Dialog open={seqLink !== null} onClose={() => setSeqLink(null)}>
        <Box p={10} textAlign={'center'}>
          <p>Файл готов</p>
          <Button variant={'contained'} href={seqLink || ''}>
            Загрузить
          </Button>
        </Box>
      </Dialog>
    </React.Fragment>
  )
}

const useStyles = makeStyles({
  video: {
    position: 'fixed',
  },
  canvas: {
    position: 'fixed',
  },
  loader: {
    position: 'absolute',
    width: 120,
    borderRadius: '1em',
    padding: '1em',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiCircularProgress-root': {color: '#fff'},
    '& span': {color: '#fff', textAlign: 'center', display: 'block', width: '100%', fontSize: 12},
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: '50%',
    '&:hover,&:active,&:focus': {backgroundColor: 'rgba(0,0,0,0.3)'},
    '& .MuiSvgIcon-root': {
      color: '#fff',
      fontSize: '1.7em',
    },
    '&.Mui-disabled': {
      backgroundColor: 'rgba(0,0,0,0.3)',
      '& .MuiSvgIcon-root': {color: 'rgba(255,255,255,0.2)'},
    },
  },
  rec: {
    backgroundColor: 'red',
    borderRadius: '50%',
    width: 30,
    height: 30,
    position: 'absolute',
    right: 20,
    top: 20,
  },
})
