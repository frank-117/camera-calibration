import './App.css';
import {useState} from "react";
import MainScreen from "./MainScreen";
import ResultsScreen from "./ResultsScreen";

const resultsInitialState = {
    rmsReProjectionError: 0,
    cameraMatrix: [],
    distCoeffs: [],
    rvecs: [],
    tvecs: [],
    picturesTaken: []
};

function App() {

    const [results, setResults] = useState(resultsInitialState);

    const restartCalibration = () => {
        setResults(resultsInitialState);
    };

    return (
        results === resultsInitialState
            ?
            <MainScreen
                setResults={setResults}
            />
            :
            <ResultsScreen
                results={results}
                restartCalibration={restartCalibration}
            />
    );
}

export default App;
