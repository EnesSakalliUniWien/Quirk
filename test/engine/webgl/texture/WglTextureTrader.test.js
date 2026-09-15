import {Suite, assertThat} from '../../../TestUtil.js';
import {WglTextureTrader} from '../../../../src/engine/webgl/texture/WglTextureTrader.js';
import {WglConfiguredShader} from '../../../../src/engine/webgl/shader/WglConfiguredShader.js';

const suite = new Suite('WglTextureTrader');
suite.test('configuration and rendering failures return destination once and preserve source ownership', () => {
    for (const failure of ['configure', 'render']) {
        let sourceReturns = 0, destinationReturns = 0;
        const source = {deallocByDepositingInPool: () => sourceReturns++};
        const destination = {deallocByDepositingInPool: () => destinationReturns++};
        const trader = new WglTextureTrader(source);
        trader.dontDeallocCurrentTexture();
        const error = new Error(failure);
        const shader = Object.create(WglConfiguredShader.prototype);
        shader.renderTo = () => {throw error;};
        let caught;
        try {trader.shadeAndTrade(() => {if (failure === 'configure') throw error; return shader;}, destination);}
        catch (e) {caught = e;}
        assertThat(caught === error).isEqualTo(true);
        assertThat(destinationReturns).isEqualTo(1);
        assertThat(sourceReturns).isEqualTo(0);
        assertThat(trader.currentTexture === source).isEqualTo(true);
        shader.renderTo = () => {};
        trader.shadeAndTrade(shader, destination);
        assertThat(sourceReturns).isEqualTo(0);
        assertThat(trader.currentTexture === destination).isEqualTo(true);
    }
});
