import './ResultsScreen.css';
import {Accordion, Card, Col, Container, OverlayTrigger, Row, Tooltip} from "react-bootstrap";
import JSZip from "jszip";
import {saveAs} from 'file-saver';
import {ReactComponent as HomeIcon} from "./assets/home.svg";
import {ReactComponent as DownloadIcon} from "./assets/download.svg";
import FadeIn from "react-fade-in";

function ResultsScreen(props) {

    const rmsReProjectionError = props.results.rmsReProjectionError;
    const cameraMatrix = props.results.cameraMatrix;
    const distCoeffs = props.results.distCoeffs;
    const rvecs = props.results.rvecs;
    const tvecs = props.results.tvecs;
    const picturesTaken = props.results.picturesTaken;

    const displayRMSReProjectionError = () => {
        if (rmsReProjectionError) {
            return <p>
                {rmsReProjectionError}
            </p>
        }
    };

    const displayCameraMatrix = () => {
        if (cameraMatrix) {
            return <p>
                {'[ ' + cameraMatrix[0] + ' , ' + cameraMatrix[1] + ' , ' + cameraMatrix[2] + ' ,'}<br/>{'  ' +
                cameraMatrix[3] + ' , ' + cameraMatrix[4] + ' , ' + cameraMatrix[5] + ' ,'}<br/>{'  ' +
                cameraMatrix[6] + ' , ' + cameraMatrix[7] + ' , ' + cameraMatrix[8] + ' ]'}
            </p>;
        }
    };

    const displayDistCoeffs = () => {
        if (distCoeffs) {
            return <p>
                {'[ ' + distCoeffs[0] + ' ,'}<br/>{'  ' +
                distCoeffs[1] + ' ,'}<br/>{'  ' +
                distCoeffs[2] + ' ,'}<br/>{'  ' +
                distCoeffs[3] + ' ,'}<br/>{'  ' +
                distCoeffs[4] + ' ]'}
            </p>;
        }
    };

    const displayVecs = (vecs) => {
        let vecsValues = [];
        vecs.map((value, index) => {
            if (vecs.length === 1) vecsValues.push(<>{'[ [ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' +
                vecs[index][2] + ' ] ]'}</>);
            else if (index === 0) vecsValues.push(<>{'[ [ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' +
                vecs[index][2] + ' ] , '}<br/></>);
            else if (index === vecs.length - 1) vecsValues.push(<>{'  [ ' + vecs[index][0] + ' , ' + vecs[index][1] +
                ' , ' + vecs[index][2] + ' ] ]'}</>);
            else vecsValues.push(<>{'  [ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' + vecs[index][2] +
                    ' ] , '}<br/></>);
        });
        return <p>
            {vecsValues.map((row) => row)}
        </p>;
    };

    const displayRvecs = () => {
        if (rvecs) {
            return displayVecs(rvecs);
        }
    };

    const displayTvecs = () => {
        if (tvecs) {
            return displayVecs(tvecs);
        }
    };

    const displayDataCard = (header, body) => {
        return (
            <Card className="d-inline-block text-center">
                <Card.Header>
                    <Card.Title>
                        {header}
                    </Card.Title>
                </Card.Header>
                <Card.Body>
                    <Card.Text>
                        {body}
                    </Card.Text>
                </Card.Body>
            </Card>
        );
    };

    const getVecsCalibrationData = (vecs) => {
        let vecsValues = '';
        vecs.map((value, index) => {
            if (vecs.length === 1) vecsValues += '[ [ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' +
                vecs[index][2] + ' ] ]';
            else if (index === 0) vecsValues += '[ [ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' +
                vecs[index][2] + ' ] ,\n ';
            else if (index === vecs.length - 1) vecsValues += '[ ' + vecs[index][0] + ' , ' + vecs[index][1] +
                ' , ' + vecs[index][2] + ' ] ]';
            else vecsValues += '[ ' + vecs[index][0] + ' , ' + vecs[index][1] + ' , ' + vecs[index][2] + ' ] ,\n ';
        });
        return vecsValues;
    };

    const getCalibrationData = () => {
        let data = '';
        if (rmsReProjectionError) {
            data += '* Error Final de Calibración:\n' +
                rmsReProjectionError + '\n\n';
        }
        if (cameraMatrix) {
            data += '* Matriz de Cámara:\n' +
                '[ ' + cameraMatrix[0] + ' , ' + cameraMatrix[1] + ' , ' + cameraMatrix[2] + ' ,\n ' +
                cameraMatrix[3] + ' , ' + cameraMatrix[4] + ' , ' + cameraMatrix[5] + ' ,\n ' +
                cameraMatrix[6] + ' , ' + cameraMatrix[7] + ' , ' + cameraMatrix[8] + ' ]\n\n';
        }
        if (distCoeffs) {
            data += '* Coeficientes de Distorción:\n' +
                '[ ' + distCoeffs[0] + ' ,\n ' +
                distCoeffs[1] + ' ,\n ' +
                distCoeffs[2] + ' ,\n ' +
                distCoeffs[3] + ' ,\n ' +
                distCoeffs[4] + ' ]\n\n';
        }
        if (rvecs) {
            data += '* Vectores de Rotación:\n' +
                getVecsCalibrationData(rvecs) + '\n\n';
        }
        if (tvecs) {
            data += '* Vectores de Traslación:\n' +
                getVecsCalibrationData(tvecs);
        }
        return data;
    };

    const getCurrentTimeISOString = () => {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        return (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
    };

    const downloadData = () => {
        const zip = new JSZip();
        zip.file("resultados.txt", getCalibrationData());
        const imgs = zip.folder("fotografias");
        picturesTaken.map((pic, index) => {
            const idx = pic.indexOf('base64,') + 'base64,'.length;
            const content = pic.substring(idx);
            imgs.file('fotografia-' + index + '.png', content, {base64: true});
        });
        zip.generateAsync({type: "blob"}).then(function (content) {
            saveAs(content, "resultados-calibracion-" + getCurrentTimeISOString() + ".zip");
        });
    };

    return (
        <Container fluid className="results-screen-container">
            <Row className="results-screen-row-1 bg-primary bg-opacity-25 mb-5">
                <Col className="results-screen-row-1-col-1 d-flex justify-content-center align-items-center">
                    <OverlayTrigger
                        key='home'
                        placement='bottom'
                        overlay={
                            <Tooltip id={`tooltip-home`}>
                                Volver al inicio
                            </Tooltip>
                        }
                    >
                        <HomeIcon
                            className="home-icon"
                            onClick={props.restartCalibration}
                        />
                    </OverlayTrigger>
                </Col>
                <Col className="results-screen-row-1-col-2 d-flex justify-content-center align-items-center">
                    <h1>Resultados</h1>
                </Col>
                <Col className="results-screen-row-1-col-3 d-flex justify-content-center align-items-center">
                    <OverlayTrigger
                        key='download'
                        placement='bottom'
                        overlay={
                            <Tooltip id={`tooltip-download`}>
                                Descargar resultados
                            </Tooltip>
                        }
                    >
                        <DownloadIcon
                            className="download-icon"
                            onClick={downloadData}
                        />
                    </OverlayTrigger>
                </Col>
            </Row>
            <FadeIn
                delay={200}
                transitionDuration={1600}
            >
                <Row className="mb-5">
                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                        {displayDataCard('Error Final de Calibración', displayRMSReProjectionError())}
                    </Col>
                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                        {displayDataCard('Matriz de Cámara', displayCameraMatrix())}
                    </Col>
                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                        {displayDataCard('Coeficientes de Distorción', displayDistCoeffs())}
                    </Col>
                </Row>
                <Row className="mb-5">
                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                        {displayDataCard('Vectores de Rotación', displayRvecs())}
                    </Col>
                    <Col className="fill-full-space d-flex justify-content-center align-items-center">
                        {displayDataCard('Vectores de Traslación', displayTvecs())}
                    </Col>
                </Row>
                <Row className="pb-5">
                    <Col>
                        <Accordion>
                            <Accordion.Item eventKey="0">
                                <Accordion.Header>
                                    <div className="fill-full-space text-center">
                                        <span>Fotografías Tomadas</span>
                                    </div>
                                </Accordion.Header>
                                <Accordion.Body>
                                    <div className="text-center">
                                        {
                                            picturesTaken.map((pic, index) =>
                                                <img src={pic} alt='board_pic' key={index} className="px-4 py-4"/>
                                            )
                                        }
                                    </div>
                                </Accordion.Body>
                            </Accordion.Item>
                        </Accordion>
                    </Col>
                </Row>
            </FadeIn>
        </Container>
    );
}

export default ResultsScreen;
