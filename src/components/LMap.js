import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Col, Row } from 'reactstrap';
import Ecology from '../data/ecology.json';

const LMap = () => {
    const [selectedLat, setSelectedLat] = useState(0);
    const [selectedLng, setSelectedLng] = useState(0);
    const mapRef = useRef(null)
    const lastCircleRef = useRef(null)

    const colorMap = useMemo(() => ({
        'saprotrophic': 'red',
        'parasitic': 'darkviolet',
        'mycorrhizal': 'yellow',
        'lichenaceous': 'green',
        'pathogenic': 'aqua',
        'unknown': 'transparent',
    }), [])

    async function fetchObservations(pageNumber) {
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/observations?lat=${selectedLat}&lng=${selectedLng}&radius=0.5&per_page=200&taxon_id=47170&hrank=genus&page=${pageNumber}`);

            if (!response.ok) {
                throw new Error('Network response not ok')
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('There has been a problem with your fetch operation:', error);
        }
    }

    function getEcology(genus, species) {
        // Return the ecology field for the specific species, or the genus if species doesn't exist (or 'unknown' if there's nothing at all)
        return Ecology[genus]?.[species]?.[0] ?? Ecology[genus]?.["genus"][0] ?? 'unknown'
    }

    async function populateMap() {
        if (!mapRef.current || !selectedLat || !selectedLng) return;

        const currentLat = selectedLat, currentLng = selectedLng
        console.log(currentLat, currentLng);

        const map = mapRef.current;
        let isFinished = false;
        const maxRequests = 15;
        let requestIndex = 1;
        const counts = {};

        while (!isFinished && requestIndex <= maxRequests) {
            const observations = await fetchObservations(requestIndex);
            observations.results.forEach((result) => {
                // Converts string into array of numbers
                const [lat, lng] = result.location.split(',').map(Number);
                const [genus, species] = result.taxon.name.split(' ');
                
                const ecology = getEcology(genus, species);
                const paneName = ecology || 'unknown'; // Use 'unknown' if ecology is not found
                if (!map.getPane(paneName)) {
                    console.error(`Pane "${paneName}" not found.`);
                    return;
                }
                if (ecology === 'unknown') {
                    counts[genus] = (counts[genus] || 0) + 1
                    console.log(genus, species)
                }

                const color = colorMap[ecology] ?? 'slategray';
    
                // Adds marker at lat/lng
                L.circle([lat, lng], {
                    stroke: false,
                    color,
                    fillOpacity: '1',
                    radius: 20,
                    pane: ecology
                }).bindPopup("<b>" + result.taxon.name + "</b>").addTo(map);
            });
            if (200 * requestIndex >= observations.total_results) break;
            requestIndex += 1;
        }
        console.log(counts)
    }

    useEffect(() => {
        if (mapRef.current) return;

        const map = L.map('map').setView([37.871874, -122.259890], 16);
        mapRef.current = map;

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        Object.keys(colorMap).forEach((ecology) => {
            map.createPane(ecology).style.opacity = 0.5;
        });

        // Handle map click
        function onMapClick(e) {
            setSelectedLat(e.latlng.lat);
            setSelectedLng(e.latlng.lng);

            // Remove the last circle if it exists
            if (lastCircleRef.current) {
                map.removeLayer(lastCircleRef.current);
            }

            // Add a new purple circle and store the reference
            const newCircle = L.circle([e.latlng.lat, e.latlng.lng], {
                color: 'purple',
                fillOpacity: 0,
                radius: 500
            }).addTo(map);

            lastCircleRef.current = newCircle; // Update the reference to the new circle
        }

        map.on('click', onMapClick);
    }, [colorMap]);
    

    return (
        <Row>
            <Col md={{offset: 3, size: 6}}>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <button onClick={populateMap} style={{height: '30px'}}>Populate organisms</button>
                    <div id='map' className="leaflet-map" />
                </div>
            </Col>
        </Row>
    )
}

export default LMap;