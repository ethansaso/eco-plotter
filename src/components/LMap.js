import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Col, Form, FormGroup, Input, Label, Row } from 'reactstrap';
import Ecology from '../data/ecology.json';

const LMap = () => {
    const [selectedLat, setSelectedLat] = useState(0);
    const [selectedLng, setSelectedLng] = useState(0);
    const mapRef = useRef(null)
    const lastCircleRef = useRef(null)
    const meterRadius = 650;

    const colorMap = useMemo(() => ({
        'saprotrophic': 'red',
        'parasitic': 'darkviolet',
        'mycorrhizal': 'yellow',
        'lichenaceous': 'green',
        'pathogenic': 'aqua',
        'unknown': 'slategray',
    }), [])

    async function fetchObservations(pageNumber) {
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/observations?lat=${selectedLat}&lng=${selectedLng}&radius=${meterRadius / 1000}&per_page=200&taxon_id=47170&hrank=genus&page=${pageNumber}`);

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

        const addResultsToMap = (observations) => {
            observations.results.forEach((result) => {
                const [lat, lng] = result.location.split(',').map(Number);
                const [genus, species] = result.taxon.name.split(' ');

                const ecology = getEcology(genus, species);
                const paneName = ecology || 'unknown';

                if (!map.getPane(paneName)) {
                    console.error(`Pane "${paneName}" not found.`);
                    return;
                }
                if (ecology === 'unknown') {
                    counts[genus] = (counts[genus] || 0) + 1;
                    console.log(genus, species);
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
        }
    
        const currentLat = selectedLat, currentLng = selectedLng;
        console.log(currentLat, currentLng);
    
        const map = mapRef.current;
        const maxRequests = 30;
        const counts = {};
    
        try {
            // First request to get total results and first page of data
            const initialResponse = await fetchObservations(1);
            const totalResults = initialResponse.total_results;
            const totalPages = Math.ceil(totalResults / 200); // Assuming 200 results per page
    
            // Calculate how many requests we can make
            const pagesToFetch = Math.min(maxRequests, totalPages);
            let requestIndex = 2;

            addResultsToMap(initialResponse)
    
            while (requestIndex <= pagesToFetch) {
                const requests = [];
                for (let i = 0; i < 5 && requestIndex <= pagesToFetch; i++) {
                    requests.push(fetchObservations(requestIndex));
                    requestIndex++;
                }
    
                // Wait for all 5 requests to complete
                const results = await Promise.all(requests);
    
                results.forEach((observations) => {
                    addResultsToMap(observations)
                });
    
                // Break the loop if we have processed all results
                if (requestIndex > pagesToFetch) {
                    break;
                }
            }
    
            console.log(counts);
    
        } catch (error) {
            console.error('Error fetching observations:', error);
        }
    }

    const togglePaneVisibility = (ecology) => {
        const map = mapRef.current;
        const pane = map.getPane(ecology);
        console.log(pane.style.display);
        if (pane.style.display === 'none') {
            pane.style.display = 'block';
        } else {
            pane.style.display = 'none';
        }
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
                radius: meterRadius
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
                    <Form className="checkbox-section">
                        {Object.keys(colorMap).map((ecology) => {
                            return (
                                <FormGroup key={ecology} switch>
                                    <Input
                                    type="switch"
                                    role="switch"
                                    defaultChecked={true}
                                    onClick={() => togglePaneVisibility(ecology)}
                                    />
                                    <Label check>{ecology}</Label>
                                </FormGroup>
                            )
                        })}
                    </Form>
                </div>
            </Col>
        </Row>
    )
}

export default LMap;