import './MainScreen.css';
import {useEffect, useRef, useState} from "react";
import cv from "@techstark/opencv-js";
import {Button, Col, Container, OverlayTrigger, Row, Spinner, Tooltip} from "react-bootstrap";
import Swal from "sweetalert2";
import Webcam from "react-webcam";
import CameraFlashingGif from "./assets/camera-flashing.gif";
import {ReactComponent as InstructionsIcon} from "./assets/instructions.svg";
import {ReactComponent as DownloadCircularButtonIcon} from "./assets/download-circular-button.svg";
import LoadingOverlay from 'react-loading-overlay';

const fileDownload = require('js-file-download');

function MainScreen(props) {

    const [cvArucoLoaded, setCVArucoLoaded] = useState(false);
    const [dictionary, setDictionary] = useState(null);
    const [board, setBoard] = useState(null);
    const [webcamReady, setWebcamReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [calibrating, setCalibrating] = useState(false);
    const [picturesTaken, setPicturesTaken] = useState([]);
    const [imageSize, setImageSize] = useState(null);

    const [rmsReProjectionError, setRmsReProjectionError] = useState(0);
    const [cameraMatrix, setCameraMatrix] = useState(null);
    const [distCoeffs, setDistCoeffs] = useState(null);
    const [rvecs, setRvecs] = useState(null);
    const [tvecs, setTvecs] = useState(null);

    const webcamRef = useRef(null);
    const imgRef = useRef(null);
    const charucoImgRef = useRef(null);
    const visionImgRef = useRef(null);
    const saveImgRef = useRef(false);
    const calibratingRef = useRef(false);
    const allCharucoCornersRef = useRef([]);
    const allCharucoIdsRef = useRef([]);
    const picturesTakenRef = useRef([]);

    const cleanAllVariables = (isCancel = false) => {
        if (!isCancel) {
            setCVArucoLoaded(false);
            setDictionary(null);
            setBoard(null);
        }
        setWebcamReady(false);
        setCapturing(false);
        setCalibrating(false);
        setPicturesTaken([]);
        setImageSize(null);
        setRmsReProjectionError(0);
        setCameraMatrix(null);
        setDistCoeffs(null);
        setRvecs(null);
        setTvecs(null);
        webcamRef.current = null;
        imgRef.current = null;
        charucoImgRef.current = null;
        visionImgRef.current = null;
        saveImgRef.current = false;
        calibratingRef.current = false;
        allCharucoCornersRef.current = [];
        allCharucoIdsRef.current = [];
        picturesTakenRef.current = [];
    };

    const sleep = async (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    const waitForArucoToLoad = async () => {
        try {
            new cv.aruco_Dictionary(cv.DICT_4X4_50);
        } catch (e) {
            await sleep(250);
            await waitForArucoToLoad();
        }
    };

    useEffect(async () => {
        await waitForArucoToLoad();
        const theDictionary = new cv.aruco_Dictionary(cv.DICT_4X4_50);
        const theBoard = new cv.aruco_CharucoBoard(5, 7, 0.04, 0.02, theDictionary);
        setDictionary(theDictionary);
        setBoard(theBoard);
        setCVArucoLoaded(true);
    }, []);

    const alertBoardNotFound = () => {
        Swal.fire({
            icon: 'warning',
            html: '<span>No se detectó el tablero.<br/>Por favor, inténtelo nuevamente.</span>'
        }).then(() => {
            calibratingRef.current = false;
            setCalibrating(calibratingRef.current);
        });
    };

    useEffect(() => {
        if (!cvArucoLoaded) return;

        const detectCharucoBoard = async () => {
            const imageSrc = webcamRef?.current?.getScreenshot();
            if (!imageSrc) return;

            return new Promise((resolve) => {
                imgRef.current.src = imageSrc;
                imgRef.current.onload = () => {
                    try {
                        const img = cv.imread(imgRef.current);
                        const frame = new cv.Mat();
                        cv.cvtColor(img, frame, cv.COLOR_RGBA2RGB);
                        const corners = new cv.MatVector();
                        const ids = new cv.Mat();
                        const rejectedImgPoints = new cv.MatVector();
                        const arucoParam = new cv.aruco_DetectorParameters()
                        cv.detectMarkers(frame, dictionary, corners, ids, arucoParam, rejectedImgPoints);
                        if (ids.size().height > 0) {
                            const charucoCorners = new cv.Mat();
                            const charucoIds = new cv.Mat();
                            cv.interpolateCornersCharuco(corners, ids, frame, board, charucoCorners, charucoIds);
                            if (charucoIds.size().height > 0) {
                                cv.drawDetectedCornersCharuco(frame, charucoCorners, charucoIds);
                                if (saveImgRef.current) {
                                    allCharucoCornersRef.current.push(charucoCorners);
                                    allCharucoIdsRef.current.push(charucoIds);
                                    picturesTakenRef.current.push(imageSrc);
                                    setPicturesTaken([...picturesTakenRef.current]);
                                    if (!imageSize) {
                                        setImageSize(new cv.Size(frame.matSize[1], frame.matSize[0]));
                                    }
                                }
                            } else if (saveImgRef.current) {
                                alertBoardNotFound();
                            }
                        } else if (saveImgRef.current && calibratingRef.current) {
                            alertBoardNotFound();
                        }
                        cv.imshow(visionImgRef.current, frame);
                        saveImgRef.current = false;
                        img.delete();
                        frame.delete();
                        corners.delete();
                        ids.delete();
                        rejectedImgPoints.delete();
                        arucoParam.delete();
                        resolve();
                    } catch (error) {
                        if (error.message !== 'Please input the valid canvas or img id.') {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                html: '<span>Ha ocurrido un error durante la captura.<br/>Por favor, inténtelo ' +
                                    'nuevamente.</span>'
                            });
                            console.log(error);
                        }
                        resolve();
                    }
                };
            });
        };

        let handle;
        const nextTick = () => {
            handle = requestAnimationFrame(async () => {
                await detectCharucoBoard();
                nextTick();
            });
        };
        nextTick();
        return () => {
            cancelAnimationFrame(handle);
        };
    }, [cvArucoLoaded]);

    useEffect(() => {
        if (imageSize && picturesTaken.length) {
            calibrateCamera();
        }
    }, [imageSize, picturesTaken]);

    const startCapture = () => {
        setCapturing(true);
    };

    const cancelCapture = () => {
        Swal.fire({
            title: 'Advertencia',
            text: '¿Está seguro que desea cancelar la calibración en progreso?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#32CD32',
            cancelButtonColor: '#FF0000',
            confirmButtonText: 'Sí',
            cancelButtonText: 'No',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                cleanAllVariables(true);
            }
        });
    };

    const [prevState, setPrevState] = useState({});

    const capture = () => {
        calibratingRef.current = true;
        setCalibrating(calibratingRef.current);
        setPrevState({
            picturesTaken,
            imageSize,
            rmsReProjectionError,
            cameraMatrix,
            distCoeffs,
            rvecs,
            tvecs,
            dateAux: (new Date()).toISOString()
        });
    }

    useEffect(() => {
        if (calibrating) {
            saveImgRef.current = true;
        }
    }, [calibrating, prevState]);

    const finishCapture = () => {
        Swal.fire(
            'Éxito',
            'Calibración exitosa',
            'success'
        ).then(() => {
            saveCalibrationResults();
            cleanAllVariables();
        });
    };

    const saveCalibrationResults = () => {
        props.setResults({
            rmsReProjectionError,
            cameraMatrix,
            distCoeffs,
            rvecs,
            tvecs,
            picturesTaken
        });
    };

    const getMatArrayValues = (mat) => {
        return mat.data64F.map((v) => v);
    };

    const getMatVectorArrayValues = (matVector) => {
        let matVectorArray = [];
        for (let i = 0; i < matVector.size(); i++) {
            matVectorArray.push(getMatArrayValues(matVector.get(i)));
        }
        return matVectorArray;
    };

    const calibrateCamera = () => {
        let corners = new cv.MatVector();
        allCharucoCornersRef.current.map((c) => corners.push_back(c));
        let ids = new cv.MatVector();
        allCharucoIdsRef.current.map((i) => ids.push_back(i));
        const cameraMatrix = new cv.Mat();
        const distCoeffs = new cv.Mat();
        const rvecs = new cv.MatVector();
        const tvecs = new cv.MatVector();
        try {
            const rmsReProjectionError = cv.calibrateCameraCharuco(
                corners,
                ids,
                board,
                imageSize,
                cameraMatrix,
                distCoeffs,
                rvecs,
                tvecs
            );
            setRmsReProjectionError(rmsReProjectionError);
            setCameraMatrix(getMatArrayValues(cameraMatrix));
            setDistCoeffs(getMatArrayValues(distCoeffs));
            setRvecs(getMatVectorArrayValues(rvecs));
            setTvecs(getMatVectorArrayValues(tvecs));
            calibratingRef.current = false;
            setCalibrating(calibratingRef.current);
        } catch (error) {
            returnToPrevState();
            Swal.fire({
                icon: 'error',
                title: 'Error',
                html: '<span>La última fotografía no fue detectada correctamente.<br/>Por favor, intente que la ' +
                    'mayor cantidad de esquinas posibles sean detectadas en el tablero para lograr una mejor ' +
                    'precisión.</span>'
            }).then(() => {
                calibratingRef.current = false;
                setCalibrating(calibratingRef.current);
            });
            console.log(error);
        }
    };

    const returnToPrevState = () => {
        setPicturesTaken(prevState.picturesTaken);
        setImageSize(prevState.imageSize);
        setRmsReProjectionError(prevState.rmsReProjectionError);
        setCameraMatrix(prevState.cameraMatrix);
        setDistCoeffs(prevState.distCoeffs);
        setRvecs(prevState.rvecs);
        setTvecs(prevState.tvecs);
        if (picturesTaken.length < picturesTakenRef.current.length) {
            allCharucoCornersRef.current.pop();
            allCharucoIdsRef.current.pop();
            picturesTakenRef.current.pop();
        }
    };

    const showInstructions = () => {
        Swal.fire(
            'Instrucciones',
            '<ol>' +
            '<li class="py-3">Descargue el tablero de calibración desde el botón correspondiente en esta misma ' +
            'pantalla de calibración (debajo del botón de <span class="fst-italic">Instrucciones</span>).</li>' +
            '<li class="pb-3">Imprima el tablero, o envíeselo a algún otro dispositivo desde el cual pueda ' +
            'visualizarlo (preferentemente en pantalla completa).</li>' +
            '<li class="pb-3">Ponga el tablero frente a la cámara, verificando que sus intersecciones sean ' +
            'detectadas en pantalla con color rojo.</li>' +
            '<li class="pb-3">Con las intersecciones detectadas, presione el botón de ' +
            '<span class="fst-italic">Capturar imagen</span>.</li>' +
            '<li class="pb-3">Mueva el tablero a diferentes posiciones y capture nuevas imágenes hasta que le ' +
            'parezca necesario.</li>' +
            '<li>Presione el botón de <span class="fst-italic">Finalizar</span>, lo que lo llevará a la pantalla de ' +
            'resultados.</li>' +
            '</ol>'
        );
    };

    const downloadCharucoBoard = () => {
        const dst = new cv.Mat();
        board.draw(new cv.Size(200 * 3, 200 * 3), dst);
        const flippedDst = new cv.Mat();
        cv.flip(dst, flippedDst, 1);
        cv.imshow(charucoImgRef.current, flippedDst);
        dst.delete();
        const canvas = document.getElementById('charuco-board');
        canvas.toBlob((blob) => fileDownload(blob, 'tablero-charuco.png'));
    };

    const disableFinishCalibrationButton = () => {
        return picturesTaken.length === 0;
    };

    return (
        <Container fluid className="main-screen-container">
            {
                cvArucoLoaded
                    ?
                    <>
                        <Row className="main-screen-row-1 bg-secondary bg-opacity-10">
                            <Col className="fill-full-space d-flex justify-content-center align-items-center">
                                <h1>Calibrador de Cámaras</h1>
                            </Col>
                        </Row>
                        <Row className="main-screen-row-2">
                            <Col className="main-screen-row-2-col-1">
                                {
                                    webcamReady &&
                                    <>
                                        <Row className="main-screen-row-2-col-1-row-1">
                                            <Col className="fill-full-space text-center">
                                                <div className="pictures-taken-container">
                                                    <h5>Fotografías tomadas:</h5>
                                                    <h5 className="bg-dark bg-opacity-10">{picturesTaken.length}</h5>
                                                </div>
                                            </Col>
                                        </Row>
                                        <Row className="main-screen-row-2-col-1-row-2">
                                            <Col className="fill-full-space text-center">
                                                <div className="calibration-error-container">
                                                    <h5>Error de calibración:</h5>
                                                    <h5 className="bg-dark bg-opacity-10">{rmsReProjectionError}</h5>
                                                </div>
                                            </Col>
                                        </Row>
                                    </>
                                }
                            </Col>
                            <Col
                                className="main-screen-row-2-col-2 fill-full-space d-flex justify-content-center
                                align-items-center">
                                {
                                    capturing
                                        ?
                                        <>
                                            <Webcam
                                                ref={webcamRef}
                                                mirrored
                                                screenshotFormat="image/jpeg"
                                                onUserMedia={() => setWebcamReady(true)}

                                            />
                                            <img className="inputImage" alt="input" ref={imgRef}/>
                                            {
                                                webcamReady
                                                    ?
                                                    <LoadingOverlay
                                                        active={calibrating}
                                                        spinner
                                                        text='Cargando...'
                                                    >
                                                        <canvas className="visionImage" ref={visionImgRef}/>
                                                    </LoadingOverlay>
                                                    :
                                                    <Spinner animation="border" variant="primary" role="status">
                                                        <span className="visually-hidden">Loading...</span>
                                                    </Spinner>
                                            }
                                        </>
                                        :
                                        <div
                                            className="start-capturing-button-container d-flex justify-content-center
                                            align-items-center bg-dark bg-opacity-10">
                                            <Button
                                                className="border border-dark"
                                                variant="primary"
                                                onClick={startCapture}
                                            >
                                                Comenzar
                                            </Button>
                                        </div>
                                }
                            </Col>
                            <Col className="main-screen-row-2-col-3">
                                {
                                    webcamReady &&
                                    <>
                                        <Row className="main-screen-row-2-col-3-row-1">
                                            <Col
                                                className="fill-full-space d-flex justify-content-center
                                                align-items-center">
                                                <h6>Instrucciones</h6>
                                                <InstructionsIcon
                                                    className="instructions-icon"
                                                    onClick={showInstructions}
                                                />
                                            </Col>
                                        </Row>
                                        <canvas className="charuco-image" ref={charucoImgRef} id='charuco-board'/>
                                        <Row className="main-screen-row-2-col-3-row-2">
                                            <Col
                                                className="fill-full-space d-flex justify-content-center
                                                align-items-center">
                                                <h6>Descargar tablero</h6>
                                                <DownloadCircularButtonIcon
                                                    className="download-circular-button-icon"
                                                    onClick={downloadCharucoBoard}
                                                />
                                            </Col>
                                        </Row>
                                    </>
                                }
                            </Col>
                        </Row>
                        <Row className={(webcamReady ? "bg-dark bg-opacity-10" : "") + " main-screen-row-3"}>
                            {
                                webcamReady
                                    ?
                                    <>
                                        <Col
                                            className="main-screen-row-3-col-1 fill-full-space d-flex
                                            justify-content-center align-items-center">
                                            <Button
                                                className="cancel-calibration-button border border-dark"
                                                variant="danger"
                                                onClick={cancelCapture}
                                            >
                                                Cancelar calibración
                                            </Button>
                                        </Col>
                                        <Col
                                            className="main-screen-row-3-col-1 fill-full-space d-flex
                                            justify-content-center align-items-center">
                                            <Button
                                                className="capture-image-button border border-dark"
                                                variant="primary"
                                                onClick={capture}
                                            >
                                                Capturar imagen
                                            </Button>
                                        </Col>
                                        <Col
                                            className="main-screen-row-3-col-2 fill-full-space d-flex
                                            justify-content-center align-items-center">
                                            {
                                                disableFinishCalibrationButton()
                                                    ?
                                                    <OverlayTrigger
                                                        key='finish-calibration-button-disabled'
                                                        placement='left'
                                                        overlay={
                                                            <Tooltip id={`tooltip-finish-calibration-button-disabled`}>
                                                                {"Debe tomar por lo menos una fotografía para poder " +
                                                                    "finalizar la calibración"}
                                                            </Tooltip>
                                                        }
                                                    >
                                                        <span className="finish-calibration-button">
                                                            <Button
                                                                className={"fill-full-space button-disabled " +
                                                                    "border border-dark"}
                                                                variant="success"
                                                                disabled
                                                            >
                                                                Finalizar
                                                            </Button>
                                                        </span>
                                                    </OverlayTrigger>
                                                    :
                                                    <Button
                                                        className="finish-calibration-button border border-dark"
                                                        variant="success"
                                                        onClick={finishCapture}
                                                    >
                                                        Finalizar
                                                    </Button>
                                            }
                                        </Col>
                                    </>
                                    :
                                    !capturing &&
                                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                                        <img src={CameraFlashingGif} alt="camera_gif" className="camera-flashing-gif"/>
                                    </Col>
                            }
                        </Row>
                    </>
                    :
                    <Row className="loader-row">
                        <Col className="fill-full-space d-flex justify-content-center align-items-center">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </Spinner>
                        </Col>
                    </Row>
            }
        </Container>
    );
}

export default MainScreen;
