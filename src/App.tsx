import {useEffect, useState, useRef} from 'react'
import {Box, Grid, makeStyles, CircularProgress, IconButton, Snackbar} from '@material-ui/core'
import {FlipCameraIos, Fullscreen, FullscreenExit, AccessibilityNew} from '@material-ui/icons'
import {Alert} from '@material-ui/lab'

import {
  Pose,
  POSE_CONNECTIONS,
  POSE_LANDMARKS_LEFT,
  POSE_LANDMARKS_RIGHT,
  POSE_LANDMARKS_NEUTRAL,
  Results,
} from '@mediapipe/pose'
import {drawConnectors, drawLandmarks} from '@mediapipe/drawing_utils'

export const App = () => {
  const classes = useStyles()

  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  //const canvasCtx = useRef<CanvasRenderingContext2D>(canvas.current ? canvas.current.getContext('2d') : null)

  const [fps, setFps] = useState(0)
  const [ready, setReady] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string>('')
  const [front, setFront] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  //const [detector, setDetector] = useState<Pose | null>(null)

  useEffect(() => {
    const s = `scaleX(${front ? -1 : 1})`
    if (canvas.current && video.current) {
      canvas.current.style.transform = s
      video.current.style.transform = s
    }

    initCamera()
    loadPose()
  }, [])

  const loadPose = async () => {
    setLoading('Pose Solution Assets')

    try {
      const pose = new Pose({
        locateFile: (file) => {
          //console.log(file)
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          //return `/assets/mediapipe/${file}`
        },
      })
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      let ctx: CanvasRenderingContext2D
      if (canvas.current) {
        ctx = canvas.current.getContext('2d') as CanvasRenderingContext2D
      }

      pose.onResults((res) => {
        canvas.current && renderFrame(res, ctx)
      })

      // await pose.initialize()
      sendFrames(pose)
    } catch (err) {
      setLoading(null)
      setAlertMsg(`${err.message.substring(0, 80)}...`)
      console.error(err)
    }
  }

  const initCamera = async () => {
    try {
      const w = window.innerWidth
      const h = window.innerHeight
      const videoConstraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: {ideal: front ? 'user' : 'environment'},
          aspectRatio: {ideal: w >= h ? w / h : h / w},
          frameRate: {ideal: 30},
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(videoConstraints)
      console.info('camera ready')

      if (video.current && canvas.current) {
        video.current.srcObject = stream
        let playPromise = video.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then((_) => {})
            .catch((error) => {
              setLoading(null)
              setAlertMsg(`${error.message.substring(0, 80)}...`)
              console.error(error)
            })
        }
      }
    } catch (err) {
      setLoading(null)
      setAlertMsg(`${err.message.substring(0, 80)}...`)
      console.error('Camera init error:', err)
    }
  }

  const sendFrames = async (pose: Pose) => {
    let times: number[] = []
    const loop = async () => {
      if (video.current) {
        video.current.width = video.current.videoWidth
        video.current.height = video.current.videoHeight

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

  const renderFrame = (results: Results, ctx: CanvasRenderingContext2D) => {
    if (canvas.current && video.current) {
      canvas.current.width = video.current.videoWidth
      canvas.current.height = video.current.videoHeight

      ctx.save()
      ctx.clearRect(0, 0, canvas.current.width, canvas.current.height)
      //ctx.drawImage(results.image, 0, 0, canvas.current.width, canvas.current.height)

      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        visibilityMin: 0.65,
        lineWidth: 4,
        color: 'white',
      })

      if (results.poseLandmarks) {
        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_LEFT).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'rgb(255,138,0)', lineWidth: 2},
        )
        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_RIGHT).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'rgb(0,217,231)', lineWidth: 2},
        )
        drawLandmarks(
          ctx,
          Object.values(POSE_LANDMARKS_NEUTRAL).map((i) => results.poseLandmarks[i]),
          {visibilityMin: 0.65, color: 'white', fillColor: 'white', lineWidth: 2},
        )
      }

      ctx.restore()
    }
  }

  const capture = () => {
    console.log('cap')
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
    await initCamera()
    setLoading('')

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen && document.exitFullscreen()
    }
  }

  return (
    <Grid container justify={'center'} alignItems={'center'} style={{height: '100%'}}>
      <Grid item xs={12} style={{position: 'relative', height: '100%', width: '100%'}}>
        <video ref={video} className={`${classes.video} input_video`}></video>
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
        open={alertMsg.length > 0}
        anchorOrigin={{vertical: 'top', horizontal: 'right'}}
        autoHideDuration={6000}
        onClose={() => setAlertMsg('')}
      >
        <Alert onClose={() => setAlertMsg('')} elevation={6} variant={'filled'} severity={'warning'}>
          {alertMsg}
        </Alert>
      </Snackbar>

      <Box position={'absolute'} left={5} top={5}>
        <span style={{color: '#fff'}}>{fps}</span>
      </Box>
      <Box position={'absolute'} right={20} bottom={20}>
        <IconButton disabled={!ready} className={classes.button} onClick={flipCamera}>
          <FlipCameraIos />
        </IconButton>
      </Box>
      <Box position={'absolute'} bottom={15}>
        <IconButton disabled={!ready} className={classes.button} style={{padding: 20}} onClick={capture}>
          <AccessibilityNew />
        </IconButton>
      </Box>
      <Box position={'absolute'} left={20} bottom={20}>
        <IconButton className={classes.button} onClick={toggleFullScreen}>
          {document.fullscreenElement ? <FullscreenExit /> : <Fullscreen />}
        </IconButton>
      </Box>
    </Grid>
  )
}

const useStyles = makeStyles({
  video: {
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '100%',
  },
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    width: 100,
    borderRadius: '1em',
    padding: '1em',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiCircularProgress-root': {color: '#fff'},
    '& span': {color: '#fff', textAlign: 'center', display: 'block', width: '100%', fontSize: 10},
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
})
