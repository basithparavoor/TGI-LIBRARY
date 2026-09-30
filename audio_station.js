// audio_station.js - Read-Aloud & Accessibility Speech Synthesizer
import { showToast, playAudioChime } from './ui.js';

const PASSAGES = {
    'excerpt-1': {
        title: 'Clean Code: Functions & Craftsmanship',
        subtitle: 'Author: Robert C. Martin • Section 3.2',
        text: 'The first rule of functions is that they should be small. The second rule of functions is that they should be smaller than that. Functions should do one thing. They should do it well. They should do it only. Master programmers think of systems as stories to be told rather than programs to be written.'
    },
    'excerpt-2': {
        title: 'Physics of the Universe: Gravity & Relativity',
        subtitle: 'Albert Einstein Foundation • Modern Physics Series',
        text: 'Space and time are not independent entities, but are woven together into a flexible fabric known as spacetime. Massive objects like stars and planets curve the spacetime around them. This curvature directs the motion of objects, which we perceive as the force of gravity. Light itself bends as it passes through gravitational fields.'
    },
    'excerpt-3': {
        title: 'Shakespeare: The Tempest (Act 1)',
        subtitle: 'William Shakespeare • Classic Literature Collection',
        text: 'Our revels now are ended. These our actors, as I foretold you, were all spirits and are melted into air, into thin air. And, like the baseless fabric of this vision, the cloud-capp’d towers, the gorgeous palaces, the solemn temples, the great globe itself, yea, all which it inherit, shall dissolve.'
    },
    'excerpt-4': {
        title: 'Computer Science: Turing Machines & Logic',
        subtitle: 'Alan Turing • Foundations of Computing',
        text: 'A Turing machine is a mathematical model of computation describing an abstract machine that manipulates symbols on a strip of tape according to a table of rules. Despite the model’s simplicity, it is capable of implementing any computer algorithm. It forms the mathematical foundation of modern computer science.'
    }
};

let currentPassageKey = 'excerpt-1';
let currentSentences = [];
let activeSentenceIndex = 0;
let isSpeaking = false;
let isPaused = false;
let voices = [];

document.addEventListener('DOMContentLoaded', () => {
    initVoices();
    loadPassage(currentPassageKey);
    setupEventListeners();
});

function initVoices() {
    const voiceSelect = document.getElementById('audio-voice-select');
    if (!voiceSelect) return;

    function populateVoiceList() {
        if (!('speechSynthesis' in window)) {
            voiceSelect.innerHTML = '<option value="">Speech synthesis not supported in this browser</option>';
            return;
        }

        voices = window.speechSynthesis.getVoices();
        const englishVoices = voices.filter(v => v.lang.startsWith('en') || v.lang.startsWith('en-US') || v.lang.startsWith('en-GB'));
        const displayVoices = englishVoices.length > 0 ? englishVoices : voices;

        voiceSelect.innerHTML = displayVoices.map((v, i) => `
            <option value="${i}">${v.name} (${v.lang}) ${v.default ? ' — Default' : ''}</option>
        `).join('');
    }

    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }
}

function loadPassage(key) {
    currentPassageKey = key;
    const readerTitle = document.getElementById('reader-title');
    const readerSubtitle = document.getElementById('reader-subtitle');
    const container = document.getElementById('reader-passage-container');
    const statsText = document.getElementById('reader-stats-text');

    stopSpeech();

    let textContent = '';
    if (key === 'custom') {
        textContent = document.getElementById('custom-text-input').value.trim() || 'Please paste or type text in the box on the left, then click Read Aloud.';
        readerTitle.innerText = 'Custom Student Notes / Material';
        readerSubtitle.innerText = 'User-Pasted Document';
    } else {
        const item = PASSAGES[key];
        readerTitle.innerText = item.title;
        readerSubtitle.innerText = item.subtitle;
        textContent = item.text;
    }

    // Split into sentences for karaoke highlighting
    currentSentences = textContent.match(/[^.!?]+[.!?]+/g) || [textContent];
    activeSentenceIndex = 0;

    container.innerHTML = currentSentences.map((sent, idx) => `
        <span class="passage-sentence" id="sentence-${idx}" style="cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background 0.2s;">
            ${sent.trim()} 
        </span>
    `).join(' ');

    const wordsCount = textContent.split(/\s+/).length;
    const estMinutes = Math.max(1, Math.ceil(wordsCount / 130));
    statsText.innerText = `${wordsCount} words • ~${estMinutes} min listening time`;

    // Click on sentence to start reading from that sentence
    container.querySelectorAll('.passage-sentence').forEach((el, idx) => {
        el.addEventListener('click', () => {
            activeSentenceIndex = idx;
            speakSentence(activeSentenceIndex);
        });
    });
}

function speakSentence(index) {
    if (index >= currentSentences.length) {
        stopSpeech();
        showToast('Finished reading passage', 'info');
        return;
    }

    window.speechSynthesis.cancel();

    // Highlight sentence in UI
    document.querySelectorAll('.passage-sentence').forEach((el, i) => {
        if (i === index) {
            el.className = 'passage-sentence highlight-spoken';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            el.className = 'passage-sentence';
        }
    });

    const textToSpeak = currentSentences[index].trim();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    const voiceIndex = document.getElementById('audio-voice-select').value;
    if (voices[voiceIndex]) utterance.voice = voices[voiceIndex];

    utterance.rate = parseFloat(document.getElementById('audio-rate').value) || 1.0;
    utterance.pitch = parseFloat(document.getElementById('audio-pitch').value) || 1.0;

    utterance.onend = () => {
        if (isSpeaking && !isPaused) {
            activeSentenceIndex++;
            speakSentence(activeSentenceIndex);
        }
    };

    utterance.onerror = (e) => {
        console.error('Speech error', e);
        stopSpeech();
    };

    isSpeaking = true;
    isPaused = false;
    document.getElementById('audio-speaking-indicator').style.display = 'flex';
    window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
    isSpeaking = false;
    isPaused = false;
    window.speechSynthesis.cancel();
    document.querySelectorAll('.passage-sentence').forEach(el => el.className = 'passage-sentence');
    document.getElementById('audio-speaking-indicator').style.display = 'none';
}

function setupEventListeners() {
    // Book Select Dropdown
    document.getElementById('audio-book-select')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const customGroup = document.getElementById('custom-text-group');
        if (val === 'custom') {
            customGroup.style.display = 'block';
        } else {
            customGroup.style.display = 'none';
        }
        loadPassage(val);
    });

    document.getElementById('custom-text-input')?.addEventListener('input', () => {
        if (currentPassageKey === 'custom') loadPassage('custom');
    });

    // Speed Rate Slider
    document.getElementById('audio-rate')?.addEventListener('input', (e) => {
        document.getElementById('rate-value-text').innerText = `${parseFloat(e.target.value).toFixed(1)}x`;
        if (isSpeaking) speakSentence(activeSentenceIndex);
    });

    // Pitch Slider
    document.getElementById('audio-pitch')?.addEventListener('input', (e) => {
        document.getElementById('pitch-value-text').innerText = parseFloat(e.target.value).toFixed(1);
    });

    // Play / Pause / Stop
    document.getElementById('btn-play-audio')?.addEventListener('click', () => {
        if (isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
            isSpeaking = true;
            document.getElementById('audio-speaking-indicator').style.display = 'flex';
        } else {
            activeSentenceIndex = 0;
            speakSentence(0);
        }
    });

    document.getElementById('btn-pause-audio')?.addEventListener('click', () => {
        if (isSpeaking && !isPaused) {
            window.speechSynthesis.pause();
            isPaused = true;
            document.getElementById('audio-speaking-indicator').style.display = 'none';
            showToast('Playback paused', 'info');
        }
    });

    document.getElementById('btn-stop-audio')?.addEventListener('click', stopSpeech);

    // Text Size Toggles
    const container = document.getElementById('reader-passage-container');
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            container.className = `text-size-${btn.dataset.size}`;
        });
    });
}
