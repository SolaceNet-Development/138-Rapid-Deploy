import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import { ChakraProvider, CSSReset } from '@chakra-ui/react';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Proposals from './pages/Proposals';
import CreateProposal from './pages/CreateProposal';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';

function getLibrary(provider: any) {
  return new ethers.providers.Web3Provider(provider);
}

function App() {
  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <ChakraProvider>
        <CSSReset />
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/create" element={<CreateProposal />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </BrowserRouter>
      </ChakraProvider>
    </Web3ReactProvider>
  );
}

export default App;
