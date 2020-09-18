// import BN from 'bn.js';
import { abi } from './kittyMarketplace.abi';
import { offerTypes } from '../js/kittyConstants';


export class KittyMarketPlaceService {
    contractAddress = '0x28ccB94Bd17cE7F2B70C785Ed89a614d97266FFF';
    user;
    _contract;
    _contractPromise;
    _kittyService;
    offers = [];
    marketSubscriptions = [];

    constructor(web3, kittyService) {
        this.web3 = web3;
        this._kittyService = kittyService;

        this.subscribeToEvents();
        this.getAllTokenOnSale();
    }

    async getContract() {
        if (this._contract) {
            return this._contract;
        } else if (this._contractPromise) {
            return this._contractPromise;
        }

        this._contractPromise = this.web3.eth.getAccounts().then(accounts => {
            this._contract = new this.web3.eth.Contract(
                abi,
                this.contractAddress,
                { from: accounts[0] }
            );
            this.user = accounts[0];
            console.log('user: ', this.user, 'contract: ', this._contract);

            return this._contract;
        });

        return this._contractPromise;
    }

    async subscribeToEvents() {
        window.ethereum.on(
            'accountsChanged',
            this.onAccountChanged
        );

        const instance = await this.getContract();
        instance.events.MarketTransaction()
            .on('data', this.onMarketEvent)
            .on('error', console.error);
    }

    onMarketEvent = (event) => {
        let trans = event.returnValues;
        console.log('On Marketplace event: ', trans, 'subscriptions: ', this.marketSubscriptions.length);

        // emit event
        this.marketSubscriptions.forEach(sub => sub(trans));
    }

    onAccountChanged = (accounts) => {
        console.log('account changed: ', accounts);
        this.user = accounts[0];
    }

    async getKitty(id) {
        return this._kittyService.getKitty(id);
    }

    async getOffer(tokenId) {
        //TODO: add hasOffer(uint256 _tokenId) function to contract
        // to avoid revert as it spams the console with error messages
        // even though it's caught
        const instance = await this.getContract();
        return instance.methods.getOffer(tokenId)
            .call({ from: this.user })
            .catch(err => {
                if (!err.message.includes('offer not active')) {
                    console.error(err);
                }
                return undefined;
            });
    }

    async getOffers(offerType) {
        if (offerType === offerTypes.sell) {
            return this.getAllTokenOnSale();
        }
        return this.getAllSireOffers();
    }

    async getAllTokenOnSale() {
        const instance = await this.getContract();
        const offerIds = await instance.methods
            .getAllTokenOnSale()
            .call({ from: this.user });

        this.offers = await this.getOffersForIds(offerIds);
        // let promises = offerIds.map(id => this.getOffer(id));
        // this.offers = await Promise.all(promises);

        // promises = this.offers.map(offer => this.getKitty(offer.tokenId)
        //     .then(kitty => offer.kitty = kitty));
        // await Promise.all(promises);

        console.log(`Offers loaded: `, this.offers);

        return this.offers;
    }

    async getOffersForIds(tokenIds) {
        let promises = tokenIds.map(id => this.getOffer(id));
        const offers = await Promise.all(promises);

        promises = offers.map(offer => this.getKitty(offer.tokenId)
            .then(kitty => offer.kitty = kitty));
        await Promise.all(promises);

        return offers;
    }

    async getAllSireOffers() {
        const instance = await this.getContract();
        const offerIds = await instance.methods
            .getAllSireOffers()
            .call({ from: this.user });

        this.offers = this.getOffersForIds(offerIds);
        return this.offers;
    }

    isApproved() {
        return this._kittyService
            .isApproved(this.contractAddress);
    }

    approve() {
        // set the market as an approved operator
        return this._kittyService
            .approve(this.contractAddress);
    }

    async sellKitty(kittyId, price) {
        console.log('kittyId: ', kittyId, ' price: ', price, typeof price);

        // throw if market is NOT operator
        // call contract to sell kitty
        const instance = await this.getContract();
        const priceInWei = this.web3.utils
            .toWei(price, 'ether');
        console.log('priceInWei: ', priceInWei);

        return instance.methods
            .setOffer(priceInWei, kittyId)
            .send({ from: this.user })
            .then(() => true)
            .catch(this.handleErr);
    }

    async buyKitty(offer) {
        // TODO: check user balance for insufficient funds
        const instance = await this.getContract();
        return instance.methods
            .buyKitty(offer.tokenId)
            .send({ from: this.user, value: offer.price })
            .then(() => true)
            .catch(this.handleErr);
    }

    async setSireOffer(kittyId, price) {
        const instance = await this.getContract();
        const priceInWei = this.web3.utils
            .toWei(price, 'ether');
        console.log(`Creating sire offer of ${price} for kittyId: ${kittyId}`);

        return instance.methods
            .setSireOffer(priceInWei, kittyId)
            .send({ from: this.user })
            .then(() => true)
            .catch(this.handleErr);
    }

    async buySireRites(offer, matronId) {
        console.log('buySireRites:: offer: ', offer, ' matronId: ', matronId);
        const instance = await this.getContract();
        return instance.methods
            .buySireRites(offer.tokenId, matronId)
            .send({ from: this.user, value: offer.price })
            .then(() => true)
            .catch(this.handleErr);
    }

    async removeOffer(tokenId) {
        console.log('Removing offer for kittyId:', tokenId);
        const instance = await this.getContract();
        return instance.methods
            .removeOffer(tokenId)
            .send({ from: this.user })
            .then(() => true)
            .catch(this.handleErr);
    }

    handleErr(err) {
        console.error(err);
        return false;
    }

}
