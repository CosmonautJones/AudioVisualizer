/**
 * Manual Mode Switching Test Script
 * Run this in the browser console at http://localhost:5175 to test functionality
 */

console.log('🧪 Starting Mode Switching Test Suite...');

// Test 1: Check if all required DOM elements exist
function testDOMElements() {
    console.log('\n--- Test 1: DOM Elements ---');
    const requiredElements = [
        'viz-mode',
        'bar-controls',
        'mandala-controls',
        'bar-count-slider',
        'mandala-segments',
        'mandala-rings',
        'mandala-rotation',
        'mandala-palette',
        'mandala-symmetry',
        'visualizer'
    ];
    
    let allFound = true;
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`❌ Element missing: ${id}`);
            allFound = false;
        } else {
            console.log(`✅ Found element: ${id}`);
        }
    });
    
    return allFound;
}

// Test 2: Check if global functions exist
function testGlobalFunctions() {
    console.log('\n--- Test 2: Global Functions ---');
    const functions = ['switchVisualizationMode', 'getCurrentVisualizationConfig'];
    
    let allFound = true;
    functions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ Global function exists: ${funcName}`);
        } else {
            console.error(`❌ Global function missing: ${funcName}`);
            allFound = false;
        }
    });
    
    return allFound;
}

// Test 3: Test mode switching via dropdown
function testModeDropdown() {
    console.log('\n--- Test 3: Mode Dropdown ---');
    const vizModeSelector = document.getElementById('viz-mode');
    
    if (!vizModeSelector) {
        console.error('❌ Mode selector not found');
        return false;
    }
    
    console.log(`✅ Current mode: ${vizModeSelector.value}`);
    
    // Test switching to mandala
    console.log('🔄 Switching to mandala mode...');
    vizModeSelector.value = 'mandala';
    vizModeSelector.dispatchEvent(new Event('change'));
    
    setTimeout(() => {
        const barControls = document.getElementById('bar-controls');
        const mandalaControls = document.getElementById('mandala-controls');
        
        if (barControls.style.display === 'none' && mandalaControls.style.display !== 'none') {
            console.log('✅ Mandala mode: Controls switched correctly');
        } else {
            console.error('❌ Mandala mode: Control visibility incorrect');
        }
        
        // Test switching back to bars
        console.log('🔄 Switching back to bars mode...');
        vizModeSelector.value = 'bars';
        vizModeSelector.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
            if (barControls.style.display !== 'none' && mandalaControls.style.display === 'none') {
                console.log('✅ Bars mode: Controls switched correctly');
            } else {
                console.error('❌ Bars mode: Control visibility incorrect');
            }
        }, 100);
    }, 100);
    
    return true;
}

// Test 4: Test global function calls
function testGlobalFunctionCalls() {
    console.log('\n--- Test 4: Global Function Calls ---');
    
    try {
        // Test switching to mandala via global function
        if (window.switchVisualizationMode) {
            window.switchVisualizationMode('mandala', {
                segments: 24,
                rings: 3,
                rotationSpeed: 1.5,
                colorPalette: 'solar',
                symmetryMode: 'radial-4x'
            });
            console.log('✅ Global switchVisualizationMode called successfully');
            
            // Test getting current config
            if (window.getCurrentVisualizationConfig) {
                const config = window.getCurrentVisualizationConfig();
                console.log('✅ Current config:', config);
            }
        } else {
            console.error('❌ switchVisualizationMode not available');
        }
    } catch (error) {
        console.error('❌ Error calling global functions:', error);
    }
}

// Test 5: Test control reactivity
function testControlReactivity() {
    console.log('\n--- Test 5: Control Reactivity ---');
    
    const controls = [
        { id: 'mandala-segments', value: 16 },
        { id: 'mandala-rings', value: 5 },
        { id: 'mandala-rotation', value: 3.5 },
        { id: 'mandala-palette', value: 'crystal' },
        { id: 'mandala-symmetry', value: 'mirror-x' }
    ];
    
    controls.forEach(({ id, value }) => {
        const element = document.getElementById(id);
        if (element) {
            const originalValue = element.value;
            element.value = value;
            element.dispatchEvent(new Event(element.type === 'range' ? 'input' : 'change'));
            
            // Check if value display updated
            const valueSpan = element.parentElement?.querySelector('.slider-value');
            if (valueSpan && element.type === 'range') {
                if (valueSpan.textContent.includes(value.toString())) {
                    console.log(`✅ ${id}: Value display updated`);
                } else {
                    console.warn(`⚠️ ${id}: Value display may not have updated`);
                }
            }
            
            console.log(`✅ ${id}: Changed from ${originalValue} to ${value}`);
        } else {
            console.error(`❌ ${id}: Element not found`);
        }
    });
}

// Test 6: Check for JavaScript errors
function testForErrors() {
    console.log('\n--- Test 6: JavaScript Errors ---');
    
    // Store original error handler
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;
    
    let errorCount = 0;
    const errors = [];
    
    window.onerror = (message, source, lineno, colno, error) => {
        errorCount++;
        errors.push({ message, source, lineno, colno, error });
        console.error(`❌ JavaScript Error ${errorCount}:`, message, 'at', source, lineno);
        originalError?.(message, source, lineno, colno, error);
    };
    
    window.onunhandledrejection = (event) => {
        errorCount++;
        errors.push({ type: 'unhandled-rejection', reason: event.reason });
        console.error('❌ Unhandled Promise Rejection:', event.reason);
        originalUnhandledRejection?.(event);
    };
    
    if (errorCount === 0) {
        console.log('✅ No JavaScript errors detected');
    } else {
        console.error(`❌ ${errorCount} JavaScript errors detected`);
    }
    
    return { errorCount, errors };
}

// Run all tests
function runAllTests() {
    console.log('🧪 Audio Visualizer Mode Switching Test Suite');
    console.log('===============================================');
    
    const results = {
        domElements: testDOMElements(),
        globalFunctions: testGlobalFunctions(),
        errorCheck: testForErrors()
    };
    
    // Async tests with delays
    setTimeout(() => {
        results.modeDropdown = testModeDropdown();
    }, 500);
    
    setTimeout(() => {
        results.globalCalls = testGlobalFunctionCalls();
    }, 1000);
    
    setTimeout(() => {
        results.controlReactivity = testControlReactivity();
        
        // Final report
        setTimeout(() => {
            console.log('\n=== FINAL TEST REPORT ===');
            console.log('DOM Elements:', results.domElements ? '✅ PASS' : '❌ FAIL');
            console.log('Global Functions:', results.globalFunctions ? '✅ PASS' : '❌ FAIL');
            console.log('Mode Dropdown:', results.modeDropdown ? '✅ PASS' : '❌ FAIL');
            console.log('Global Calls:', results.globalCalls ? '✅ PASS' : '❌ FAIL');
            console.log('Control Reactivity:', results.controlReactivity ? '✅ PASS' : '❌ FAIL');
            console.log('JavaScript Errors:', results.errorCheck.errorCount === 0 ? '✅ NONE' : `❌ ${results.errorCheck.errorCount}`);
            
            const totalTests = Object.keys(results).length;
            const passedTests = Object.values(results).filter(r => r === true || (r && r.errorCount === 0)).length;
            
            console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
        }, 2000);
    }, 1500);
    
    return results;
}

// Export functions for manual testing
window.testVisualizerModeSwitching = {
    runAll: runAllTests,
    testDOMElements,
    testGlobalFunctions,
    testModeDropdown,
    testGlobalFunctionCalls,
    testControlReactivity,
    testForErrors
};

console.log('🎯 Test suite ready! Run: testVisualizerModeSwitching.runAll()');
console.log('Or run individual tests: testVisualizerModeSwitching.testDOMElements()');

// Auto-run tests after page loads
if (document.readyState === 'complete') {
    setTimeout(runAllTests, 1000);
} else {
    window.addEventListener('load', () => {
        setTimeout(runAllTests, 1000);
    });
}